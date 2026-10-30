import { encodeQuery } from './query-codec.js'
import { fillPathParams } from './path-template.js'

type RequestInputWithQuery = {
  query: unknown
}

type RequestInputWithParams = {
  params: unknown
}

type RequestInputWithBody = {
  body: unknown
}

export type BaseRequestInput = Partial<RequestInputWithQuery> &
  Partial<RequestInputWithParams> &
  Partial<RequestInputWithBody>

const isRequestWithParams = <TRequest extends BaseRequestInput>(
  obj: TRequest
): obj is TRequest & RequestInputWithParams => 'params' in obj

/** Builds the request url from a path template, its params and the query. */
export const buildUrl = (path: string, request?: BaseRequestInput): string => {
  if (!request) return path

  const urlWithParams = isRequestWithParams(request)
    ? fillPathParams(path, request.params as Record<string, unknown>)
    : path
  const stringifiedQuery = encodeQuery(request.query)

  return `${urlWithParams}${stringifiedQuery ? `?${stringifiedQuery}` : ''}`
}
