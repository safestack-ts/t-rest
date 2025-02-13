import { HTTPMethod } from '@t-rest/core'
import { RequestConfig } from './request-config'
import { HTTPResponse } from './http-response'

export interface HTTPAdapter<TRequestContext = {}> {
  request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig & TRequestContext
  ): Promise<HTTPResponse<TResponse>>
}
