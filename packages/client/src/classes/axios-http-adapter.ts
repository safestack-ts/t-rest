import { AxiosInstance } from 'axios'
import { HTTPAdapter } from '../types/http-adapter'
import { HTTPMethod } from '@t-rest/core'
import { RequestConfig } from '../types/request-config'

export class AxiosHTTPAdapter implements HTTPAdapter {
  private readonly axiosInstance: AxiosInstance

  constructor(axiosInstance: AxiosInstance) {
    this.axiosInstance = axiosInstance
  }

  async request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig
  ) {
    const response = await this.axiosInstance.request<TResponse>({
      url,
      method,
      data,
      headers: requestConfig?.headers,
    })

    return {
      data: response.data,
      statusCode: response.status,
    }
  }
}
