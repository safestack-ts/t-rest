type MultipartFileSource =
  // without a filename a buffer would arrive as a text field
  | { buffer: Buffer; path?: undefined; filename: string }
  | { path: string; buffer?: undefined; filename?: string }

export type MultipartFile = MultipartFileSource & {
  field: string
  contentType?: string
}

export type MultipartBody<TFields = Record<string, unknown>> = {
  fields?: TFields
  files?: MultipartFile[]
}

/** The text a scalar arrives as. */
type FieldText<TValue> = TValue extends number | bigint | boolean
  ? `${TValue}`
  : TValue extends null
  ? ''
  : string

type MultipartFieldMember<TMember, TField> = TMember extends undefined
  ? undefined
  : TMember extends string
  ? TMember
  : TMember extends readonly (infer TItem)[]
  ? // an empty array is left out, which only an optional field accepts
    undefined extends TField
    ? readonly MultipartFieldValue<TItem>[]
    : readonly [MultipartFieldValue<TItem>, ...MultipartFieldValue<TItem>[]]
  : TMember extends number | bigint | boolean | null | Date
  ? FieldText<TMember> extends TField
    ? TMember
    : never
  : TMember extends object
  ? { [TKey in keyof TMember]: MultipartFieldValue<TMember[TKey]> }
  : never

/**
 * A value the validator accepts once it arrived as a form field: arrays and
 * objects are flattened into bracketed names, everything else arrives as text.
 * A number, boolean, date or `null` is only accepted where the validator also
 * takes its text, e.g. through `z.coerce.number()`.
 */
export type MultipartFieldValue<TField> = unknown extends TField
  ? unknown
  : MultipartFieldMember<TField, TField>

export type MultipartFields<TBody> = unknown extends TBody
  ? Record<string, unknown>
  : TBody extends object
  ? { [TKey in keyof TBody]: MultipartFieldValue<TBody[TKey]> }
  : never

type RequiredKeys<T> = {
  [TKey in keyof T]-?: {} extends Pick<T, TKey> ? never : TKey
}[keyof T]

/**
 * Multer leaves `file` out without an upload, and `files` of `.fields()` empty.
 * The `files` array of `.array()` and `.any()` may be empty.
 */
type RequiresFile<TInput> = 'file' extends RequiredKeys<TInput>
  ? true
  : 'files' extends RequiredKeys<TInput>
  ? TInput extends { files: infer TFiles }
    ? TFiles extends readonly unknown[]
      ? false
      : {} extends TFiles
      ? false
      : true
    : false
  : false

type MultipartFieldsInput<TInput> = TInput extends { body: infer TBody }
  ? { fields: MultipartFields<TBody> }
  : 'body' extends keyof TInput
  ? { fields?: MultipartFields<TInput['body']> }
  : { fields?: Record<string, unknown> }

type MultipartFilesInput<TInput> = RequiresFile<TInput> extends true
  ? { files: [MultipartFile, ...MultipartFile[]] }
  : { files?: MultipartFile[] }

/**
 * The text fields are what the validator of the route gets as `body`. Routes
 * validating no body still accept untyped fields. A route requiring a file
 * requires one in `files`.
 */
export type MultipartInput<TInput> = MultipartFieldsInput<TInput> &
  MultipartFilesInput<TInput>
