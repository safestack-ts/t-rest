import { HTTPMethod, ResponseMap } from '@t-rest/core'
import { RequestConfig } from './request-config.js'
import { HTTPResponse } from './http-response.js'

/** How the body of a single request is encoded. */
export type RequestBodyEncoding = 'json' | 'multipart'

export interface HTTPAdapter<TRequestContext = {}> {
  /**
   * Resolves for the statuses declared in `responses` and rejects for all
   * others. `responses` holds the descriptors of the route of the request,
   * `isDeclaredStatus` and `decodeBody` implement the contract.
   *
   * `responses` follows `requestConfig`, so that an adapter written for an
   * earlier version keeps receiving its `requestConfig`.
   *
   * `bodyEncoding` is `'multipart'` when `data` is the `FormData` of a route
   * declared with `.multipart()`. It has to be sent as is, not serialized as
   * JSON: the transport sets the content type with its boundary.
   */
  request<TResponses extends ResponseMap>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig: (RequestConfig & TRequestContext) | undefined,
    responses: TResponses,
    bodyEncoding?: RequestBodyEncoding
  ): Promise<HTTPResponse<TResponses>>
}
