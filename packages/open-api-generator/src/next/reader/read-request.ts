import { pathParamNames } from '@t-rest/protocol'
import { diagnostic, Diagnostic } from '../diagnostics/registry.js'
import { dereference } from '../model/shape.js'
import type { DefKey, Field, Shape, TypeDef } from '../model/types.js'
import type { StandardJSONSchemaSource } from './convert.js'
import { pointerTo } from './json-schema.js'
import { ReaderRun, readSchema } from './read-schema.js'

export interface RequestRoute {
  readonly operation: string
  /** The t-rest path pattern, `/users/:id`. */
  readonly path: string
  readonly multipartFiles?: readonly string[]
}

export interface RequestRead {
  /** Path params in pattern order; params the validator omits are strings. */
  readonly params: readonly Field<DefKey>[]
  readonly query?: Shape<DefKey>
  readonly headers?: Shape<DefKey>
  readonly body?: { readonly shape: Shape<DefKey>; readonly required: boolean }
  readonly types: Readonly<Record<DefKey, TypeDef<DefKey>>>
  readonly diagnostics: readonly Diagnostic[]
}

const SLOTS = ['params', 'query', 'headers', 'body'] as const

const fieldsOf = (shape: Shape<DefKey>): readonly Field<DefKey>[] =>
  shape.kind === 'object' ? shape.fields : []

/** Splits one request validator into its slots. */
export const readRequest = (
  validator: StandardJSONSchemaSource,
  route: RequestRoute,
  run: ReaderRun
): RequestRead => {
  const multipartFiles = route.multipartFiles ?? []
  const read = readSchema(
    validator,
    {
      operation: route.operation,
      slot: 'request',
      direction: 'input',
      multipartFiles,
    },
    run
  )
  const root = dereference(read.shape, read.types)
  const fields = fieldsOf(root)
  const slot = (name: (typeof SLOTS)[number]) =>
    fields.find((field) => field.name === name)
  const at = (pointer: string) => ({
    operation: route.operation,
    slot: 'request',
    pointer,
  })

  const unknownSlots = fields
    .filter(
      ({ name }) =>
        !(SLOTS as readonly string[]).includes(name) &&
        !multipartFiles.includes(name)
    )
    .map(({ name }) =>
      diagnostic(
        'schema/unknown-request-slot',
        at(pointerTo('', 'properties', name)),
        { key: name }
      )
    )
  // A failed read already reported why the root is unknown.
  const notObject =
    root.kind !== 'object' &&
    !read.diagnostics.some(({ severity }) => severity === 'error')
      ? [diagnostic('schema/request-not-object', at(''), { kind: root.kind })]
      : []

  const declaredParams = fieldsOf(
    dereference(slot('params')?.shape ?? { kind: 'unknown' }, read.types)
  )
  const names = pathParamNames(route.path)
  const params: Field<DefKey>[] = [
    ...names.map(
      (name) =>
        declaredParams.find((field) => field.name === name) ?? {
          name,
          required: true,
          shape: { kind: 'string' as const },
        }
    ),
    ...declaredParams.filter((field) => !names.includes(field.name)),
  ]

  const query = slot('query')
  const headers = slot('headers')
  const body = slot('body')

  return {
    params,
    ...(query && { query: query.shape }),
    ...(headers && { headers: headers.shape }),
    ...(body && { body: { shape: body.shape, required: body.required } }),
    types: read.types,
    diagnostics: [...read.diagnostics, ...notObject, ...unknownSlots],
  }
}
