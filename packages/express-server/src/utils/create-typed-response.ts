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

export const createTypedResponse = <TRoute extends AnyRouteDef>(
  res: ExpressResponse,
  route: TRoute,
  next: ExpressNextFunction
): TypedResponse<TRoute> => {
  const statusResponse = (code: number) => {
    res.status(code)

    // the kinds are enforced by the types, a status reaching this point
    // without a descriptor is sent without a content type of its own
    const descriptor: AnyResponseDescriptor | undefined = route.responses[code]
    const setContentType = () => {
      if (descriptor?.contentType) {
        res.set('Content-Type', descriptor.contentType)
      }
    }

    return {
      json: (body: unknown) => {
        setContentType()
        res.json(body)
      },
      send: (body: string | Uint8Array) => {
        setContentType()
        res.send(typeof body === 'string' ? body : toBuffer(body))
      },
      stream: (body: NodeJS.ReadableStream) => {
        setContentType()
        // the pass through keeps pipeline from destroying the response, so
        // that error handlers can answer a stream failing before the first byte
        const passThrough = new PassThrough()

        pipeline(body, passThrough, (error) => {
          // a client closing the connection is not an application error
          if (!error || res.destroyed) {
            return
          }

          if (res.headersSent) {
            res.destroy(error)
          } else {
            res.removeHeader('Content-Type')
          }

          next(error)
        })
        passThrough.pipe(res)
        res.once('close', () => passThrough.destroy())
      },
      file: (path: string) => {
        setContentType()
        // errors are forwarded to the error handlers of the application
        res.sendFile(resolve(path))
      },
      end: () => {
        res.end()
      },
    }
  }

  const typedResponse = {
    status: statusResponse,
    json: (body: unknown) => statusResponse(200).json(body),
    header: (name: string, value: string) => {
      res.set(name, value)

      return typedResponse
    },
    raw: res,
  }

  return typedResponse as unknown as TypedResponse<TRoute>
}
