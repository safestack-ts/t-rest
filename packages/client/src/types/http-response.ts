import {
  BinaryResponseDescriptor,
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  TextResponseDescriptor,
} from '@t-rest/core'

type ResponseData<TDescriptor> = TDescriptor extends JsonResponseDescriptor<
  infer TBody
>
  ? TBody
  : TDescriptor extends TextResponseDescriptor<string>
  ? string
  : TDescriptor extends BinaryResponseDescriptor
  ? ArrayBuffer
  : TDescriptor extends EmptyResponseDescriptor
  ? undefined
  : never

/** Discriminated union of the responses a route declares, by `statusCode`. */
export type HTTPResponse<TResponses> = TResponses extends unknown
  ? {
      [TStatus in keyof TResponses & number]: {
        data: ResponseData<TResponses[TStatus]>
        statusCode: TStatus
        // @todo add more
      }
    }[keyof TResponses & number]
  : never
