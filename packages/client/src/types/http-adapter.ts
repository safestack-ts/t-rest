import { HTTPMethod } from '@typed-rest/core'
import { RequestConfig } from './request-config'
import { HTTPResponse } from './http-response'

export interface HTTPAdapter {
  request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig
  ): Promise<HTTPResponse<TResponse>>
}
