import type { StandardSchemaV1 } from '@standard-schema/spec'
import type {
  BinaryResponseDescriptor,
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  ResponseOptions,
  TextResponseDescriptor,
} from '../types/response-descriptor.js'

type SchemaOutput<TSchema> = StandardSchemaV1.InferOutput<
  TSchema & StandardSchemaV1
>

type UntypedJsonOptions<TBody> = ResponseOptions<TBody> & {
  // a schema is passed as first argument, `json<T>(schema)` must not compile
  readonly '~standard'?: never
}

// The schema is constrained in the parameter, not the type parameter, so that
// the instantiation expression `typeof json<T>` resolves to the last overload
// instead of failing the constraint. A conditional parameter type would stay
// unresolved for a generic schema, rejecting `<S extends StandardSchemaV1>`
// factories. `~standard` must come from `TSchema` itself, otherwise
// `json<T>(schema)` would compile whenever the schema is assignable to `T`.
// `TSchema` is the only type in the intersection that a `StandardSchemaV1`
// argument can match, so a plain `StandardSchemaV1` value infers as itself.
/** A json body typed and documented by the output of its schema. */
export function json<TSchema>(
  schema: TSchema & {
    readonly '~standard': StandardSchemaV1.Props &
      TSchema['~standard' & keyof TSchema]
  },
  options?: ResponseOptions<SchemaOutput<TSchema>>
): JsonResponseDescriptor<SchemaOutput<TSchema>>
/** A json body typed by a type argument, documented by the options only. */
export function json<TBody>(
  options?: UntypedJsonOptions<TBody>
): JsonResponseDescriptor<TBody>
export function json(
  schemaOrOptions?: StandardSchemaV1 | ResponseOptions<unknown>,
  options?: ResponseOptions<unknown>
): JsonResponseDescriptor<unknown> {
  const [schema, documentation] =
    schemaOrOptions && '~standard' in schemaOrOptions
      ? [schemaOrOptions, options]
      : [undefined, schemaOrOptions]

  // `~body` is a phantom, it only exists on the type level
  return {
    kind: 'json',
    contentType: 'application/json',
    '~body': null,
    ...(schema && { schema }),
    ...documentation,
  }
}

/** A text body, `text/plain` unless another content type is given. */
export function text(
  contentType?: undefined,
  options?: ResponseOptions<string>
): TextResponseDescriptor<'text/plain'>
export function text<TContentType extends string>(
  contentType: TContentType,
  options?: ResponseOptions<string>
): TextResponseDescriptor<TContentType>
export function text<TContentType extends string>(
  contentType?: TContentType,
  options?: ResponseOptions<string>
): TextResponseDescriptor<TContentType | 'text/plain'>
export function text(
  contentType = 'text/plain',
  options?: ResponseOptions<string>
): TextResponseDescriptor<string> {
  return { kind: 'text', contentType, '~body': null as any, ...options }
}

export const binary = <TContentType extends string>(
  contentType: TContentType,
  options?: Omit<ResponseOptions<Uint8Array>, 'examples'>
): BinaryResponseDescriptor<TContentType> => ({
  kind: 'binary',
  contentType,
  '~body': null as any,
  ...options,
})

export const empty = (
  options?: Omit<ResponseOptions<undefined>, 'examples'>
): EmptyResponseDescriptor => ({
  kind: 'empty',
  contentType: undefined,
  '~body': null as any,
  ...options,
})
