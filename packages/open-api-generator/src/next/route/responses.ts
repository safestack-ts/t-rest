import type { AnyResponseDescriptor } from '@t-rest/core'
import { getReasonPhrase } from 'http-status-codes'
import { Diagnostic, diagnostic, Location } from '../diagnostics/registry.js'
import { stableStringify } from '../model/json.js'
import type { DefKey, MediaType, Response } from '../model/types.js'
import { directionsAgree } from '../reader/read-schema.js'
import { unverifiable, validateExamples } from './examples.js'
import { fieldsOf } from './request.js'
import type { RouteRun } from './run.js'

export type Descriptor = AnyResponseDescriptor

const reasonPhrase = (status: string) => {
  try {
    return getReasonPhrase(status)
  } catch {
    return `Status ${status}`
  }
}

const jsonContent = (
  descriptor: Descriptor,
  at: Required<Pick<Location, 'operation' | 'slot'>>,
  run: RouteRun
): MediaType<DefKey> => {
  const { schema, examples } = descriptor
  if (!schema) run.report(diagnostic('response/untyped-json', at, {}))
  const shape = schema
    ? run.read(schema, { ...at, direction: 'output' })
    : { kind: 'unknown' as const }
  if (!examples) return { shape }

  if (!schema || !directionsAgree(schema, run.reader)) {
    run.report(
      unverifiable(
        Object.keys(examples),
        schema
          ? 'the schema reads differently as input and as output'
          : 'the descriptor has no schema',
        at
      )
    )
    return { shape, examples }
  }
  const validated = validateExamples(schema, examples, at)
  run.report(...validated.diagnostics)
  return { shape, examples: validated.examples }
}

const contentOf = (
  descriptor: Descriptor,
  at: Required<Pick<Location, 'operation' | 'slot'>>,
  run: RouteRun
): Response<DefKey>['content'] => {
  switch (descriptor.kind) {
    case 'empty':
      return {}
    case 'text':
      return {
        [descriptor.contentType]: {
          shape: { kind: 'string' },
          ...(descriptor.examples && { examples: descriptor.examples }),
        },
      }
    case 'binary':
      return {
        [descriptor.contentType]: {
          shape: { kind: 'string', contentMediaType: descriptor.contentType },
        },
      }
    case 'json':
      return { [descriptor.contentType]: jsonContent(descriptor, at, run) }
  }
}

/**
 * One status of a route: description, else the reason phrases of every status
 * it serves; headers read as output, content by kind.
 */
export const readResponse = (
  descriptor: Descriptor,
  status: string,
  operation: string,
  run: RouteRun,
  statuses: readonly string[] = [status]
): Response<DefKey> => {
  const slot = `response ${status}`
  const headers = descriptor.headers
    ? fieldsOf(
        run.read(descriptor.headers, {
          operation,
          slot: `${slot} headers`,
          direction: 'output',
        }),
        run.types
      ).map(({ name, required, shape }) => ({ name, required, shape }))
    : []

  return {
    description:
      descriptor.description ?? statuses.map(reasonPhrase).join(' or '),
    headers,
    content: contentOf(descriptor, { operation, slot }, run),
  }
}

const sameResponse = (a: Descriptor, b: Descriptor) =>
  a.kind === b.kind &&
  a.contentType === b.contentType &&
  a.schema === b.schema &&
  a.headers === b.headers &&
  a.description === b.description &&
  stableStringify(a.examples) === stableStringify(b.examples)

export interface ResponseUse {
  readonly operation: string
  readonly status: string
  readonly descriptor: Descriptor
}

/**
 * Ids whose descriptors are one shared response: the same schema object and
 * equal docs everywhere, with the statuses each serves. Every other id is
 * `naming/duplicate-response-id`.
 */
export const sharedResponseIds = (
  uses: readonly ResponseUse[]
): {
  readonly ids: ReadonlyMap<string, readonly string[]>
  readonly diagnostics: Diagnostic[]
} => {
  const first = new Map<
    string,
    { readonly use: ResponseUse; readonly statuses: Set<string> }
  >()
  const conflicting = new Set<string>()
  const diagnostics: Diagnostic[] = []

  for (const use of uses) {
    const { operation, status, descriptor } = use
    const { id } = descriptor
    if (id === undefined) continue
    const known = first.get(id)
    if (known === undefined) first.set(id, { use, statuses: new Set([status]) })
    else if (sameResponse(known.use.descriptor, descriptor))
      known.statuses.add(status)
    else if (!conflicting.has(id)) {
      conflicting.add(id)
      diagnostics.push(
        diagnostic(
          'naming/duplicate-response-id',
          { operation, slot: `response ${status}` },
          { id }
        )
      )
    }
  }

  const ids = new Map<string, readonly string[]>()
  for (const [id, { use, statuses }] of first) {
    if (conflicting.has(id)) continue
    const served = [...statuses].sort()
    ids.set(id, served)
    if (use.descriptor.description === undefined && served.length > 1)
      diagnostics.push(
        diagnostic(
          'naming/shared-response-without-description',
          { operation: use.operation, slot: `response ${use.status}` },
          { id, statuses: served }
        )
      )
  }
  return { ids, diagnostics }
}
