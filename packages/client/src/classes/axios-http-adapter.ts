import { AxiosInstance, AxiosRequestConfig, ResponseType } from 'axios'
import { HTTPAdapter } from '../types/http-adapter.js'
import { HTTPResponse } from '../types/http-response.js'
import { AnyResponseDescriptor, HTTPMethod, ResponseMap } from '@t-rest/core'
import { RequestConfig } from '../types/request-config.js'

// the transport has to be selected before the status is known, so a route
// mixing kinds uses the most generic one and each body is decoded by its status
const transportFor = (responses: ResponseMap): ResponseType => {
  const kinds = Object.values(responses).map(({ kind }) => kind)

  if (kinds.includes('binary')) {
    return 'arraybuffer'
  }

  return kinds.includes('text') ? 'text' : 'json'
}

const toText = (data: unknown) =>
  typeof data === 'string'
    ? data
    : new TextDecoder().decode(data as ArrayBuffer | Uint8Array)

// node delivers a Buffer, which may be a view on a shared pool
const toArrayBuffer = (data: unknown) =>
  ArrayBuffer.isView(data)
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : data

const decode = (
  data: unknown,
  descriptor: AnyResponseDescriptor | undefined,
  transport: ResponseType
) => {
  switch (descriptor?.kind) {
    case 'json':
      return transport === 'json' ? data : JSON.parse(toText(data))
    case 'text':
      return toText(data)
    case 'binary':
      return toArrayBuffer(data)
    case 'empty':
      return undefined
    default:
      return data
  }
}

export class AxiosHTTPAdapter implements HTTPAdapter<AxiosRequestConfig> {
  private readonly axiosInstance: AxiosInstance

  constructor(axiosInstance: AxiosInstance) {
    this.axiosInstance = axiosInstance
  }

  async request<TResponses extends ResponseMap>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    responses: TResponses,
    requestConfig?: RequestConfig & AxiosRequestConfig
  ) {
    const { params: _params, ...requestConfigWithoutParams } =
      requestConfig ?? {}
    const transport = transportFor(responses)
    const response = await this.axiosInstance.request({
      url,
      method,
      data,
      headers: requestConfig?.headers,
      responseType: transport,
      validateStatus: (status) => responses[status] !== undefined,
      ...requestConfigWithoutParams,
    })

    return {
      // a custom response type opts out of decoding
      data: requestConfig?.responseType
        ? response.data
        : decode(response.data, responses[response.status], transport),
      statusCode: response.status,
    } as HTTPResponse<TResponses>
  }
}
