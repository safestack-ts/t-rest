import {
  AnyRouteDef,
  BagOfRoutes,
  json,
  ResponseMap,
  Versioning,
} from '@t-rest/core'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { pointerTo } from '../reader/json-schema.js'

export interface TwinRoute {
  readonly validator?: StandardSchemaV1
  readonly responses: Readonly<Record<number, StandardSchemaV1>>
}

const routeKey = ({ method, path, version }: AnyRouteDef) =>
  `${method} ${path}${version ? ` @${version}` : ''}`

/** `bag` with the validators and JSON response schemas of its zod twin. */
export const twinBag = (
  bag: BagOfRoutes<any, any, any>,
  twin: Readonly<Record<string, TwinRoute>>
): BagOfRoutes<any, any, any> => {
  const routes = [...bag.routes.values()].map((route: AnyRouteDef) => {
    const { validator, responses } = twin[routeKey(route)]
    const descriptors = Object.fromEntries(
      Object.entries(route.responses as ResponseMap).map(
        ([status, descriptor]) => {
          const schema = responses[Number(status)]
          return [
            status,
            descriptor.kind === 'json' && schema ? json(schema) : descriptor,
          ]
        }
      )
    )
    return Object.assign(Object.create(Object.getPrototypeOf(route)), route, {
      ...(validator && { validator }),
      responses: descriptors,
    })
  })

  if (bag.versioning === Versioning.NO_VERSIONING)
    return routes
      .reduce(
        (builder, route) => builder.addRoute(route),
        BagOfRoutes.withoutVersioning() as any
      )
      .build()
  return routes
    .reduce(
      (builder, route) => builder.addRoute(route),
      BagOfRoutes.withVersioning(bag.versioning, bag.versionHistory) as any
    )
    .build()
}

type Json = { readonly [key: string]: any }

/**
 * The schema encodings of a document: component schemas, and the schema of
 * every parameter and media type keyed by where it sits, so the order of
 * parameters and descriptions do not count.
 */
export const projection = (document: Json) => {
  const parameters: Record<string, unknown> = {}
  const media: Record<string, unknown> = {}
  const addContent = (key: string, content: Json | undefined) => {
    for (const [type, entry] of Object.entries(content ?? {}))
      media[`${key} ${type}`] = entry.schema
  }

  for (const [path, item] of Object.entries<Json>(document.paths ?? {}))
    for (const [method, operation] of Object.entries<Json>(item)) {
      const at = `${method} ${path}`
      for (const parameter of operation.parameters ?? [])
        parameters[`${at} ${parameter.in} ${parameter.name}`] =
          parameter.schema ?? parameter.content
      addContent(`${at} request`, operation.requestBody?.content)
      for (const [status, response] of Object.entries<Json>(
        operation.responses ?? {}
      ))
        addContent(`${at} ${status}`, response.content)
    }

  return { schemas: document.components?.schemas ?? {}, parameters, media }
}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null

/** JSON pointers of the leaves where `a` and `b` differ, including keys only one side has. */
export const differences = (a: unknown, b: unknown, at = ''): string[] => {
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b))
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [at]
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  return keys.flatMap((key) => differences(a[key], b[key], pointerTo(at, key)))
}
