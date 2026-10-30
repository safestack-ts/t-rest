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

/**
 * The text fields are what the validator of the route gets as `body`. Routes
 * validating no body still accept untyped fields.
 */
export type MultipartInput<TInput> = TInput extends { body: infer TFields }
  ? MultipartBody<TFields> & { fields: TFields }
  : 'body' extends keyof TInput
  ? MultipartBody<TInput['body']>
  : MultipartBody
