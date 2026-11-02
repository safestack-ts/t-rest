import {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosResponseTransformer,
  ResponseType,
} from 'axios'
import { HTTPAdapter, RequestBodyEncoding } from '../types/http-adapter.js'
import { HTTPResponse, HTTPResponseHeaders } from '../types/http-response.js'
import { isFormDataLike } from '../utils/is-form-data-like.js'
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

// axios' own adapters already lower-case the keys, custom ones or interceptors might not.
// `headers` can be missing in mocked responses, e.g. of axios-mock-adapter.
// `false` is the sentinel of axios for a disabled header, which it omits as well.
const normalizeHeaders = (
  headers: AxiosResponse['headers'] | undefined
): HTTPResponseHeaders =>
  Object.fromEntries(
    Object.entries(headers ?? {})
      .filter(
        ([, value]) => value !== null && value !== undefined && value !== false
      )
      .map(([name, value]) => [
        name.toLowerCase(),
        Array.isArray(value) ? value : String(value),
      ])
  )

const decode = (
  response: AxiosResponse,
  responses: ResponseMap,
  transport: ResponseType | undefined,
  isEmptyBody: boolean
) => {
  const descriptor = responses[response.status]

  // axios already parsed the json body. Only an empty wire body is undefined,
  // the json encoding of an empty string stays an empty string.
  if (descriptor?.kind === 'json' && transport === undefined) {
    return isEmptyBody ? undefined : response.data
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
    responses: TResponses,
    bodyEncoding?: RequestBodyEncoding
  ) {
    const { params: _params, ...requestConfigWithoutParams } =
      requestConfig ?? {}
    const transport = transportFor(responses)
    // the parsed body of json routes cannot tell an empty wire body from the
    // json encoding of an empty string, so the wire body is checked before
    // the transforms of axios parse it
    let isEmptyBody = false
    const recordEmptyBody: AxiosResponseTransformer = (body) => {
      isEmptyBody = body === '' || body === undefined || body === null
      return body
    }
    const response = await this.axiosInstance.request({
      url,
      method,
      data,
      headers: requestConfig?.headers,
      ...(transport
        ? { responseType: transport }
        : {
            transformResponse: [
              recordEmptyBody,
              ...[this.axiosInstance.defaults.transformResponse ?? []].flat(),
            ],
          }),
      validateStatus: (status) => isDeclaredStatus(responses, status),
      ...requestConfigWithoutParams,
      // axios json-serializes form data if a default header says json, it
      // replaces this content type with the one containing the boundary
      ...((bodyEncoding ?? (isFormDataLike(data) ? 'multipart' : 'json')) ===
        'multipart' && {
        headers: {
          ...requestConfig?.headers,
          'Content-Type': 'multipart/form-data',
        },
      }),
    })

    return {
      // a custom response type opts out of decoding
      data: requestConfig?.responseType
        ? response.data
        : decode(response, responses, transport, isEmptyBody),
      statusCode: response.status,
      headers: normalizeHeaders(response.headers),
    } as HTTPResponse<TResponses> & { headers: HTTPResponseHeaders }
  }
}
