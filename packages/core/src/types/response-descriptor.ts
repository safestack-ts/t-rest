export interface ResponseDescriptor<
  TKind extends string,
  TContentType extends string | undefined,
  TBody
> {
  readonly kind: TKind
  readonly contentType: TContentType
  readonly ['~body']: TBody
}

export type JsonResponseDescriptor<TBody> = ResponseDescriptor<
  'json',
  'application/json',
  TBody
>

export type TextResponseDescriptor<TContentType extends string = 'text/plain'> =
  ResponseDescriptor<'text', TContentType, string>

// the body is what a server sends, clients map it to their binary type
export type BinaryResponseDescriptor<TContentType extends string = string> =
  ResponseDescriptor<'binary', TContentType, Uint8Array>

export type EmptyResponseDescriptor = ResponseDescriptor<
  'empty',
  undefined,
  undefined
>

export type AnyResponseDescriptor =
  | JsonResponseDescriptor<any>
  | TextResponseDescriptor<string>
  | BinaryResponseDescriptor
  | EmptyResponseDescriptor

/** The responses of a route: HTTP status code to response descriptor. */
export type ResponseMap = { readonly [status: number]: AnyResponseDescriptor }

export type DeclaredStatus<TRoute extends { '~responses': unknown }> =
  keyof TRoute['~responses'] & number

/** The descriptor of a status, a status enum member resolves like its value. */
export type ResponseDescriptorOf<
  TRoute extends { '~responses': unknown },
  TStatus extends number
> = TStatus extends keyof TRoute['~responses']
  ? TRoute['~responses'][TStatus]
  : never

/** The body type of the given statuses of a route, by default of all of them. */
export type BodyOf<
  TRoute extends { '~responses': unknown },
  TStatus extends number = DeclaredStatus<TRoute>
> = ResponseDescriptorOf<TRoute, TStatus> extends infer TDescriptor
  ? TDescriptor extends ResponseDescriptor<
      string,
      string | undefined,
      infer TBody
    >
    ? TBody
    : never
  : never
