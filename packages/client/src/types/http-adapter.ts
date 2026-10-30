import { HTTPMethod, ResponseMap } from '@t-rest/core'
import { RequestConfig } from './request-config.js'
import { HTTPResponse } from './http-response.js'

export interface HTTPAdapter<TRequestContext = {}> {
  /**
   * Resolves for the statuses declared in `responses` and rejects for all
   * others. `responses` holds the descriptors of the route of the request.
   */
  request<TResponses extends ResponseMap>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    responses: TResponses,
    requestConfig?: RequestConfig & TRequestContext
  ): Promise<HTTPResponse<TResponses>>
}
