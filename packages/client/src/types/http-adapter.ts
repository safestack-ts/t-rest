import { HTTPMethod, ResponseMap } from '@t-rest/core'
import { RequestConfig } from './request-config.js'
import { HTTPResponse } from './http-response.js'

export interface HTTPAdapter<TRequestContext = {}> {
  /**
   * Resolves for the statuses declared in `responses` and rejects for all
   * others. `responses` holds the descriptors of the route of the request,
   * `isDeclaredStatus` and `decodeBody` implement the contract.
   *
   * `responses` is the last argument, so that an adapter written for an
   * earlier version keeps receiving its `requestConfig`.
   */
  request<TResponses extends ResponseMap>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig: (RequestConfig & TRequestContext) | undefined,
    responses: TResponses
  ): Promise<HTTPResponse<TResponses>>
}
