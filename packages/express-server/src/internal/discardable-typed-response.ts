import { resolve } from 'node:path'
import { PassThrough, pipeline } from 'node:stream'
import { AnyResponseDescriptor, AnyRouteDef } from '@t-rest/core'
import {
  ExpressNextFunction,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'
import { TypedResponse } from '../types/typed-response.js'

const toBuffer = (body: Uint8Array) =>
  // express 4 serializes every object except a Buffer as json
  Buffer.isBuffer(body)
    ? body
    : Buffer.from(body.buffer, body.byteOffset, body.byteLength)

/**
 * Creates the response passed to route handlers, like `createTypedResponse`.
 *
 * `discardBody` has to be called before an error of the handler is forwarded:
 * a stream or file the handler started but which has not sent anything yet is
 * stopped, and its content type does not label the answer of the error
 * handlers.
 */
export const createDiscardableTypedResponse = <TRoute extends AnyRouteDef>(
  res: ExpressResponse,
  route: TRoute,
  next: ExpressNextFunction
): { response: TypedResponse<TRoute>; discardBody: () => void } => {
  const discards: (() => void)[] = []

  const statusResponse = (code: number) => {
    res.status(code)

    // the kinds are enforced by the types, a status reaching this point
    // without a descriptor is sent without a content type of its own
    const descriptor: AnyResponseDescriptor | undefined = route.responses[code]
    let contentTypeSet = false

    // a content type set before, e.g. `application/problem+json`, is kept,
    // like express only sets a default
    const setContentType = () => {
      if (descriptor?.contentType && !res.get('Content-Type')) {
        res.set('Content-Type', descriptor.contentType)
        contentTypeSet = true
      }
    }

    // the content type of the body would label the response of the error
    // handler, if the body fails before it is sent
    const removeContentType = () => {
      if (contentTypeSet && !res.headersSent) {
        res.removeHeader('Content-Type')
      }
    }

    const json = (body: unknown) => {
      setContentType()
      res.json(body)
    }

    return {
      json,
      send: (body: unknown) => {
        // json statuses send objects as json, like express does
        if (descriptor?.kind === 'json') {
          return json(body)
        }

        setContentType()
        res.send(typeof body === 'string' ? body : toBuffer(body as Uint8Array))
      },
      stream: (body: NodeJS.ReadableStream) => {
        setContentType()
        // the pass through keeps pipeline from destroying the response, so
        // that error handlers can answer a stream failing before the first byte
        const passThrough = new PassThrough()
        let discarded = false

        discards.push(() => {
          discarded = true
          removeContentType()
          passThrough.unpipe(res)
          // pipeline destroys the body as well
          passThrough.destroy()
        })

        pipeline(body, passThrough, (error) => {
          // a client closing the connection is not an application error, a
          // discarded stream failed with the handler
          if (!error || res.destroyed || discarded) {
            return
          }

          if (res.headersSent) {
            res.destroy(error)
          } else {
            removeContentType()
          }

          next(error)
        })
        passThrough.pipe(res)
        res.once('close', () => passThrough.destroy())
      },
      file: (path: string) => {
        setContentType()
        let discarded = false

        discards.push(() => {
          // the file is not sent once the error handlers answered
          discarded = true
          removeContentType()
        })

        // errors are forwarded to the error handlers of the application like
        // express does without a callback
        res.sendFile(resolve(path), (error?: NodeJS.ErrnoException) => {
          // a client closing the connection is not an application error
          if (
            !error ||
            discarded ||
            error.code === 'ECONNABORTED' ||
            error.syscall === 'write'
          ) {
            return
          }

          removeContentType()
          next(error.code === 'EISDIR' ? undefined : error)
        })
      },
      end: () => {
        res.end()
      },
    }
  }

  const typedResponse = {
    status: statusResponse,
    // keeps a status set before, e.g. `status(404)` without a body method
    json: (body: unknown) => statusResponse(res.statusCode).json(body),
    send: (body: unknown) => statusResponse(res.statusCode).send(body),
    header: (name: string, value: string | number | readonly string[]) => {
      res.set(
        name,
        typeof value === 'number'
          ? String(value)
          : typeof value === 'string'
          ? value
          : [...value]
      )

      return typedResponse
    },
    raw: res,
  }

  return {
    response: typedResponse as unknown as TypedResponse<TRoute>,
    discardBody: () => {
      // a body which started sending can not be taken back
      if (!res.headersSent) {
        discards.splice(0).forEach((discard) => discard())
      }
    },
  }
}
