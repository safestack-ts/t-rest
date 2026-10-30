import { HTTPMethod } from '@t-rest/core'
import { RequestConfig } from './request-config.js'
import { HTTPResponse } from './http-response.js'

export interface HTTPAdapter<TRequestContext = {}> {
  /**
   * `data` is a `FormData` for routes declared with `.multipart()`. It has to
   * be sent as is: the transport sets the content type with its boundary.
   */
  request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig & TRequestContext
  ): Promise<HTTPResponse<TResponse>>
}
