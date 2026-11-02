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

/**
 * Constrains every property of the responses to a descriptor: the numeric index
 * signature of `ResponseMap` alone accepts any object without numeric keys,
 * e.g. a body type passed where responses are expected.
 */
export type StrictResponseMap<TResponses> = ResponseMap & {
  readonly [TKey in keyof TResponses]: AnyResponseDescriptor
}

/** The statuses a route declares, of a union of routes those of every member. */
export type DeclaredStatus<TRoute extends { '~responses': unknown }> =
  TRoute extends unknown ? keyof TRoute['~responses'] & number : never

/**
 * The descriptor of a status, a status enum member resolves like its value.
 * A union of routes yields the descriptors of the members declaring it.
 */
export type ResponseDescriptorOf<
  TRoute extends { '~responses': unknown },
  TStatus extends number
> = TRoute extends unknown
  ? TStatus extends keyof TRoute['~responses']
    ? TRoute['~responses'][TStatus]
    : never
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

/**
 * The body a consumer decodes for a descriptor: the json body, a string for
 * text, and its own representations of binary and empty bodies.
 */
export type DecodedBody<
  TDescriptor,
  TBinary = Uint8Array,
  TEmpty = undefined
> = TDescriptor extends JsonResponseDescriptor<infer TBody>
  ? TBody
  : TDescriptor extends TextResponseDescriptor<string>
  ? string
  : TDescriptor extends BinaryResponseDescriptor
  ? TBinary
  : TDescriptor extends EmptyResponseDescriptor
  ? TEmpty
  : never
