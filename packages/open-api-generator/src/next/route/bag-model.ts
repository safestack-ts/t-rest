import {
  AnyRouteDef,
  BagOfRoutes,
  ResponseMap,
  Versioning as BagVersioning,
} from '@t-rest/core'
import { pathShape } from '@t-rest/protocol'
import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import { RESERVED_KEY, stableStringify } from '../model/json.js'
import type {
  ApiModel,
  DefKey,
  Example,
  HTTPMethod,
  Operation,
  Response,
  ResponseSlot,
  SecuritySchemeModel,
  Versioning,
} from '../model/types.js'
import { MODEL_VERSION } from '../model/version-history.js'
import { readRequest } from '../reader/read-request.js'
import type { BagModelConfig, RouteView } from './config.js'
import { validateExamples } from './examples.js'
import { defaultOperationId, readMeta } from './meta.js'
import { fieldsOf, parametersOf, requestBodyOf } from './request.js'
import { readResponse, sharedResponseIds } from './responses.js'
import { createRouteRun, RouteRun } from './run.js'
import {
  coveredHeaders,
  effectiveSecurity,
  EffectiveSecurity,
  securityOf,
} from './security.js'

export interface BagModel {
  /** Every route of every version, unfiltered; operations sorted by key. */
  readonly model: ApiModel<DefKey>
  /** What `filter` and the `operationId` hook see, by `Operation.key`. */
  readonly routes: ReadonlyMap<string, RouteView>
  readonly diagnostics: readonly Diagnostic[]
}

/** `GET /users/{} @2024-01-01`: params by position, so equivalent paths share a key. */
export const operationKey = (
  method: HTTPMethod,
  path: string,
  version: string
): string =>
  `${method} ${pathShape(path).replace(/%s/g, '{}')}${
    version ? ` @${version}` : ''
  }`

const versioningOf = (bag: BagOfRoutes<any, any, any>): Versioning =>
  bag.versioning === BagVersioning.NO_VERSIONING
    ? { kind: 'none' }
    : {
        kind: bag.versioning === BagVersioning.DATE ? 'date' : 'semver',
        history: [...bag.versionHistory],
      }

interface RouteEntry {
  readonly key: string
  readonly view: RouteView
  readonly route: AnyRouteDef
}

const byKey = (a: { key: string }, b: { key: string }) =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0

/** Routes sorted by key; a second route with a taken key is `operation/duplicate-route`. */
const routeEntries = (
  bag: BagOfRoutes<any, any, any>,
  run: RouteRun
): RouteEntry[] => {
  const entries = [...bag.routes.entries()]
    .map(([[method, path, version], route]) => ({
      key: operationKey(method, path, version),
      view: { method, path, version, meta: route.metaData },
      route,
    }))
    .sort(byKey)

  const unique = new Map<string, RouteEntry>()
  for (const entry of entries) {
    const known = unique.get(entry.key)
    if (known === undefined) unique.set(entry.key, entry)
    else
      run.report(
        diagnostic(
          'operation/duplicate-route',
          { operation: entry.key },
          { paths: [known.view.path, entry.view.path] }
        )
      )
  }
  return [...unique.values()]
}

const responsesOf = (route: AnyRouteDef) =>
  Object.entries(route.responses as ResponseMap)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** The `body` of each request example, for the request body's media types. */
const bodyExamples = (
  examples: Readonly<Record<string, Example>>
): Record<string, Example> =>
  Object.fromEntries(
    Object.entries(examples).flatMap(([name, example]) =>
      isRecord(example.value) && 'body' in example.value
        ? [[name, { ...example, value: example.value.body }]]
        : []
    )
  )

/**
 * Turns every route of the bag, in every version, into an operation. Pure:
 * the conversion cache and the diagnostics live only in this call.
 */
export const buildBagModel = (
  bag: BagOfRoutes<any, any, any>,
  config: BagModelConfig = {}
): BagModel => {
  const run = createRouteRun(config.vendors?.trust)
  const entries = routeEntries(bag, run)

  const globalHeaders = config.headers
    ? fieldsOf(
        run.read(config.headers, {
          operation: 'config',
          slot: 'headers',
          direction: 'input',
        }),
        run.types
      )
    : []

  const shared = sharedResponseIds(
    entries.flatMap(({ key, route }) =>
      responsesOf(route).map(([status, descriptor]) => ({
        operation: key,
        status,
        descriptor,
      }))
    )
  )
  run.report(...shared.diagnostics)
  // null prototype: author ids such as `constructor` are only ever own keys
  const responses: Record<string, Response<DefKey>> = Object.create(null)

  const securitySchemes: Record<string, SecuritySchemeModel> =
    Object.create(null)
  const conflictingSchemes = new Set<string>()
  const registerSchemes = (security: EffectiveSecurity, operation: string) => {
    for (const { scheme } of security.alternatives.flat()) {
      if (scheme.name === RESERVED_KEY) {
        if (!conflictingSchemes.has(scheme.name))
          run.report(
            diagnostic(
              'security/reserved-scheme-name',
              { operation },
              { name: scheme.name }
            )
          )
        conflictingSchemes.add(scheme.name)
        continue
      }
      const known = securitySchemes[scheme.name]
      if (known === undefined)
        securitySchemes[scheme.name] = scheme.spec as SecuritySchemeModel
      else if (
        stableStringify(known) !== stableStringify(scheme.spec) &&
        !conflictingSchemes.has(scheme.name)
      ) {
        conflictingSchemes.add(scheme.name)
        run.report(
          diagnostic(
            'security/scheme-name-conflict',
            { operation },
            { name: scheme.name }
          )
        )
      }
    }
  }

  const operationOf = ({ key, view, route }: RouteEntry): Operation<DefKey> => {
    const { method, path, version } = view
    const meta = readMeta(route.metaData, { operation: key })
    run.report(...meta.diagnostics)

    const files = route.multipartFiles ?? {}
    const read = readRequest(
      route.validator,
      { operation: key, path, multipartFiles: Object.keys(files) },
      run.reader
    )
    run.addTypes(read.types, { operation: key, slot: 'request' })
    run.report(...read.diagnostics)

    const routeHeaders = fieldsOf(read.headers, run.types)
    const security = effectiveSecurity(meta.security, routeHeaders, config)
    const covered = coveredHeaders(security, config.securityFromHeaders)
    registerSchemes(security, key)
    if (security.source === 'meta')
      for (const { name } of routeHeaders) {
        const scheme = covered.get(name.toLowerCase())
        if (scheme !== undefined)
          run.report(
            diagnostic(
              'security/header-and-scheme',
              {
                operation: key,
                slot: 'request',
                pointer: '/properties/headers',
              },
              { header: name, scheme }
            )
          )
      }

    const examples = route.requestExamples
      ? validateExamples(route.validator, route.requestExamples, {
          operation: key,
          slot: 'request',
        })
      : { examples: {}, diagnostics: [] }
    run.report(...examples.diagnostics)
    const requestBody = requestBodyOf({
      body: read.body,
      bodyEncoding: route.bodyEncoding,
      files,
      examples: bodyExamples(examples.examples),
      types: run.types,
    })

    const responseSlots = Object.fromEntries(
      responsesOf(route).map(
        ([status, descriptor]): [string, ResponseSlot<DefKey>] => {
          const { id } = descriptor
          if (id === undefined || !shared.ids.has(id))
            return [
              status,
              {
                kind: 'inline',
                response: readResponse(descriptor, status, key, run),
              },
            ]
          responses[id] ??= readResponse(
            descriptor,
            status,
            key,
            run,
            shared.ids.get(id)
          )
          return [status, { kind: 'shared', id }]
        }
      )
    )

    const parameters = parametersOf({
      read,
      routeHeaders,
      globalHeaders,
      covered,
      types: run.types,
      operation: key,
    })
    run.report(...parameters.diagnostics)

    return {
      key,
      method,
      path,
      version,
      operationId:
        meta.operationId ??
        config.operationId?.(view) ??
        defaultOperationId(method, path),
      ...meta.docs,
      parameters: parameters.parameters,
      ...(requestBody && { requestBody }),
      responses: responseSlots,
      // a reserved scheme is reported and has no definition to point at
      security: securityOf(security).map((alternative) =>
        alternative.filter(({ scheme }) => scheme !== RESERVED_KEY)
      ),
      extensions: meta.extensions,
    }
  }

  const operations = entries.map(operationOf)

  return {
    model: {
      modelVersion: MODEL_VERSION,
      versioning: versioningOf(bag),
      types: run.types,
      responses,
      securitySchemes,
      operations,
    },
    routes: new Map(entries.map(({ key, view }) => [key, view])),
    diagnostics: run.diagnostics,
  }
}
