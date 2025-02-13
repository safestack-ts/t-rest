import { demoBagOfRoutes, HTTPMethod } from '@t-rest/core'
import { HTTPAdapter } from '../types/http-adapter'
import { RequestConfig } from '../types/request-config'
import { HTTPResponse } from '../types/http-response'
import { VersionInjector } from '../classes/version-injector'
import { RESTClient } from '../classes/rest-client'

class TestVersionInjector extends VersionInjector {
  modifyHeaders(headers: Record<string, string | number | boolean>) {
    return {
      ...headers,
      'x-version': this.version,
    }
  }
}

type MyRequestConfig = {
  myCustomProperty: string
}

class MyHttpAdapter implements HTTPAdapter<MyRequestConfig> {
  request<TResponse>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig?: RequestConfig & MyRequestConfig
  ): Promise<HTTPResponse<TResponse>> {
    throw new Error('Method not implemented.')
  }
}

const apiClient = RESTClient.withVersioning(
  demoBagOfRoutes,
  '2024-03-01',
  new MyHttpAdapter(),
  TestVersionInjector
)

apiClient.get('/basket', {
  myCustomProperty: 'test',
})
