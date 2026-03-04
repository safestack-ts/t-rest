import { HTTPMethod } from '@t-rest/core'
import { RequestConfig } from './request-config.js'
import { HTTPResponse } from './http-response.js'

export interface HTTPAdapter<TRequestContext = {}> {
  request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig & TRequestContext
  ): Promise<HTTPResponse<TResponse>>
}
