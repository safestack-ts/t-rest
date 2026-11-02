import { IncomingMessage } from 'node:http'
import { AnyResponseDescriptor, ResponseMap } from '@t-rest/core'
import superagent from 'superagent'

type ParserCallback = (error: Error | null, body?: unknown) => void

type ParsedResponse = IncomingMessage & { text?: string }

type Parser = (res: ParsedResponse, callback: ParserCallback) => void

// the built-in parsers of superagent, typed for the incoming message node passes
const parsers = superagent.parse as unknown as Record<string, Parser>

const mimeOf = (contentType: string | undefined) =>
  (contentType ?? '').split(';')[0].trim().toLowerCase()

// the parser superagent selects by the content type
const contentTypeParser = (contentType: string | undefined): Parser => {
  const mime = mimeOf(contentType)
  const [type, subtype = ''] = mime.split('/')

  if (Object.prototype.hasOwnProperty.call(parsers, mime)) {
    return parsers[mime]
  }

  if (
    ['audio', 'font', 'image', 'video'].includes(type) ||
    ['gz', 'gzip'].includes(subtype)
  ) {
    return parsers.image
  }

  if (type === 'text') {
    return parsers.text
  }

  if (/[/+]json($|[^-\w])/i.test(mime)) {
    return parsers['application/json']
  }

  // a generic buffer
  return parsers.image
}

const descriptorParserOf = (
  descriptor: AnyResponseDescriptor
): Parser | undefined => {
  switch (descriptor.kind) {
    case 'json':
      return parsers['application/json']
    case 'text':
      // superagent keeps text in `text`, a text descriptor also as body
      return (res, callback) =>
        parsers.text(res, (error) => callback(error, res.text))
    case 'binary':
      // keeps the exact bytes, even of a textual media type
      return parsers.image
    case 'empty':
      return (res, callback) =>
        parsers.text(res, (error) => callback(error, {}))
  }

  return undefined
}

/**
 * A superagent parser decoding the body by the descriptor the route declares
 * for the status of the response, instead of by its content type: a text
 * descriptor of any media type is a string, a binary descriptor keeps the
 * exact bytes even for a textual media type.
 *
 * Statuses without a descriptor are parsed by the built-in parser superagent
 * selects for the content type.
 */
export const descriptorParser =
  (responses: ResponseMap): Parser =>
  (res, callback) => {
    const descriptor: AnyResponseDescriptor | undefined =
      responses[res.statusCode ?? 0]
    const parser =
      (descriptor && descriptorParserOf(descriptor)) ??
      contentTypeParser(res.headers['content-type'])

    parser(res, callback)
  }
