import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  ResponseType,
} from 'axios'
import { HTTPAdapter } from '../types/http-adapter.js'
import { HTTPResponse } from '../types/http-response.js'
import { HTTPMethod, ResponseMap } from '@t-rest/core'
import { RequestConfig } from '../types/request-config.js'
import { decodeBody, isDeclaredStatus } from '../utils/response-decoding.js'

// the transport has to be selected before the status is known, so a route
// mixing kinds uses the most generic one and each body is decoded by its
// status. Json routes keep the default of axios, which parses json leniently:
// an explicit `json` response type would make axios parse strictly, also the
// bodies of undeclared statuses, so that e.g. an html error page would reject
// with a syntax error instead of the status error.
const transportFor = (responses: ResponseMap): ResponseType | undefined => {
  const kinds = Object.values(responses).map(({ kind }) => kind)

  if (kinds.includes('binary')) {
    return 'arraybuffer'
  }

  return kinds.includes('text') ? 'text' : undefined
}

const decode = (
  response: AxiosResponse,
  responses: ResponseMap,
  transport: ResponseType | undefined
) => {
  const descriptor = responses[response.status]

  // axios already parsed the json body, an empty body stays an empty string
  if (descriptor?.kind === 'json' && transport === undefined) {
    return response.data === '' ? undefined : response.data
  }

  try {
    return decodeBody(response.data, descriptor)
  } catch (error) {
    // like axios reports a json body it fails to parse
    throw AxiosError.from(
      error,
      AxiosError.ERR_BAD_RESPONSE,
      response.config,
      response.request,
      response
    )
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
    requestConfig: (RequestConfig & AxiosRequestConfig) | undefined,
    responses: TResponses
  ) {
    const { params: _params, ...requestConfigWithoutParams } =
      requestConfig ?? {}
    const transport = transportFor(responses)
    const response = await this.axiosInstance.request({
      url,
      method,
      data,
      headers: requestConfig?.headers,
      ...(transport ? { responseType: transport } : {}),
      validateStatus: (status) => isDeclaredStatus(responses, status),
      ...requestConfigWithoutParams,
    })

    return {
      // a custom response type opts out of decoding
      data: requestConfig?.responseType
        ? response.data
        : decode(response, responses, transport),
      statusCode: response.status,
    } as HTTPResponse<TResponses>
  }
}
