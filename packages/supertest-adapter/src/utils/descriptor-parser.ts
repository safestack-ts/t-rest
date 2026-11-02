import { IncomingMessage } from 'node:http'
import { ResponseMap } from '@t-rest/core'

type ParserCallback = (error: Error | null, body?: unknown) => void

type ParsedResponse = IncomingMessage & { text?: string }

const isJSONType = (contentType: string | undefined) =>
  /[/+]json($|[^-\w])/i.test(contentType ?? '')

const parseJSON = (
  res: ParsedResponse,
  text: string,
  callback: ParserCallback
) => {
  try {
    callback(null, text === '' ? {} : JSON.parse(text))
  } catch (error) {
    Object.assign(error as Error, {
      rawResponse: text,
      statusCode: res.statusCode,
    })
    callback(error as Error)
  }
}

/**
 * A superagent parser decoding the body by the descriptor the route declares
 * for the status of the response, instead of by its content type: a text
 * descriptor of any media type is a string, a binary descriptor keeps the
 * exact bytes even for a textual media type.
 *
 * Statuses without a descriptor fall back to the content type, as superagent
 * does by default.
 */
export const descriptorParser =
  (responses: ResponseMap) =>
  (res: ParsedResponse, callback: ParserCallback) => {
    const chunks: Buffer[] = []

    res.on('data', (chunk: Buffer) => chunks.push(chunk))
    res.on('end', () => {
      const bytes = Buffer.concat(chunks)
      const descriptor = responses[res.statusCode ?? 0]

      if (descriptor?.kind === 'binary') {
        callback(null, bytes)
        return
      }

      const text = bytes.toString('utf8')
      res.text = text

      switch (descriptor?.kind) {
        case 'text':
          callback(null, text)
          return
        case 'json':
          parseJSON(res, text, callback)
          return
        case 'empty':
          callback(null, {})
          return
      }

      const contentType = res.headers['content-type']

      if (isJSONType(contentType)) {
        parseJSON(res, text, callback)
      } else if (contentType?.startsWith('text/')) {
        callback(null, text)
      } else {
        callback(null, bytes)
      }
    })
  }
