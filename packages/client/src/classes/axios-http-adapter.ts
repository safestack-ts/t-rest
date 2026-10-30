import { AxiosInstance, AxiosRequestConfig } from 'axios'
import { HTTPAdapter } from '../types/http-adapter.js'
import { HTTPMethod } from '@t-rest/core'
import { RequestConfig } from '../types/request-config.js'

export class AxiosHTTPAdapter implements HTTPAdapter<AxiosRequestConfig> {
  private readonly axiosInstance: AxiosInstance

  constructor(axiosInstance: AxiosInstance) {
    this.axiosInstance = axiosInstance
  }

  async request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig & AxiosRequestConfig
  ) {
    const { params: _params, ...requestConfigWithoutParams } =
      requestConfig ?? {}
    const response = await this.axiosInstance.request<TResponse>({
      url,
      method,
      data,
      headers: requestConfig?.headers,
      ...requestConfigWithoutParams,
      // axios json-serializes form data if a default header says json, it
      // replaces this content type with the one containing the boundary
      ...(typeof FormData !== 'undefined' &&
        data instanceof FormData && {
          headers: {
            ...requestConfig?.headers,
            'Content-Type': 'multipart/form-data',
          },
        }),
    })

    return {
      data: response.data,
      statusCode: response.status,
    }
  }
}
