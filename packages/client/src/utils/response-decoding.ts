import { AnyResponseDescriptor, ResponseMap } from '@t-rest/core'

/**
 * Whether the route declares the status. An `HTTPAdapter` resolves declared
 * statuses and rejects all others.
 */
export const isDeclaredStatus = (responses: ResponseMap, status: number) =>
  Object.prototype.hasOwnProperty.call(responses, status)

const toText = (body: string | ArrayBuffer | ArrayBufferView) =>
  typeof body === 'string' ? body : new TextDecoder().decode(body)

// node delivers a Buffer, which may be a view on a shared pool
const toArrayBuffer = (body: string | ArrayBuffer | ArrayBufferView) =>
  typeof body === 'string'
    ? new TextEncoder().encode(body).buffer
    : ArrayBuffer.isView(body)
    ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
    : body

/**
 * Decodes the raw body of a response by the descriptor of its status: json is
 * parsed, an empty json body is `undefined`, text is a string, binary an
 * `ArrayBuffer` and empty is `undefined`. Without a descriptor the body is
 * returned as is.
 *
 * Throws a `SyntaxError` for a json body which is not valid json.
 *
 * @example
 * const response = await fetch(url)
 * if (!isDeclaredStatus(responses, response.status)) {
 *   throw new Error(`Request failed with status code ${response.status}`)
 * }
 * const data = decodeBody(
 *   await response.arrayBuffer(),
 *   responses[response.status]
 * )
 */
export const decodeBody = (
  body: string | ArrayBuffer | ArrayBufferView,
  descriptor: AnyResponseDescriptor | undefined
): unknown => {
  switch (descriptor?.kind) {
    case 'json': {
      const text = toText(body)

      return text === '' ? undefined : JSON.parse(text)
    }
    case 'text':
      return toText(body)
    case 'binary':
      return toArrayBuffer(body)
    case 'empty':
      return undefined
    default:
      return body
  }
}
