import { createReadStream, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { once } from 'node:events'
import { PassThrough, Readable } from 'node:stream'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { BagOfRoutes, binary, empty, json, Route, text } from '@t-rest/core'
import Express from 'express'
import { StatusCodes } from 'http-status-codes'
import supertest from 'supertest'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'

const idValidator = z.object({ params: z.object({ id: z.string() }) })

const pdf = Buffer.from('%PDF-1.7 binary \xff')

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/invoices/:id').validate(idValidator).responses({
      200: json<{ id: string }>(),
      404: json<{ error: string }>(),
    })
  )
  .addRoute(
    Route.get('/pdf/:variant')
      .validate(z.object({ params: z.object({ variant: z.string() }) }))
      .responses({
        200: binary('application/pdf'),
        404: json<{ error: string }>(),
      })
  )
  .addRoute(Route.get('/csv').responses({ 200: text('text/csv') }))
  .addRoute(Route.get('/plain').responses({ 200: text() }))
  .addRoute(Route.delete('/invoices').responses({ 204: empty() }))
  .addRoute(Route.get('/raw').response<never>())
  .addRoute(Route.get('/headers').response<{ ok: boolean }>())
  .build()

let pdfFile: string
let endlessStream: PassThrough | undefined

const makeApp = () => {
  const expressApp = Express()
  const app = TypedExpressApplication.withoutVersioning(expressApp, bagOfRoutes)

  app.get('/invoices/:id').handle((_request, { params }, response) => {
    if (params.id === 'missing') {
      response.status(StatusCodes.NOT_FOUND).json({ error: 'not found' })
    } else {
      response.json({ id: params.id })
    }
  })

  app.get('/pdf/:variant').handle((_request, { params }, response) => {
    switch (params.variant) {
      case 'buffer':
        return response.status(200).send(pdf)
      case 'uint8array':
        return response.status(200).send(new Uint8Array(pdf))
      case 'stream':
        return response.status(200).stream(Readable.from([pdf]))
      case 'file':
        return response.status(200).file(pdfFile)
      case 'file-missing':
        return response.status(200).file(`${pdfFile}.missing`)
      case 'stream-interrupted':
        return response.status(200).stream(
          Readable.from(
            (async function* () {
              yield pdf
              // lets the first chunk reach the client
              await new Promise((resolve) => setTimeout(resolve, 10))
              throw new Error('interrupted')
            })()
          )
        )
      case 'stream-endless':
        endlessStream = new PassThrough()
        endlessStream.write(pdf)
        return response.status(200).stream(endlessStream)
      case 'stream-failing':
        return response
          .status(200)
          .stream(createReadStream(`${pdfFile}.missing`))
      default:
        return response.status(404).json({ error: 'unknown variant' })
    }
  })

  app.get('/csv').handle((_request, _validation, response) => {
    response.status(200).send('a,b')
  })

  app.get('/plain').handle((_request, _validation, response) => {
    response.status(200).send('hello')
  })

  app.delete('/invoices').handle((_request, _validation, response) => {
    response.status(204).end()
  })

  app.get('/raw').handle((_request, _validation, response) => {
    response.raw.redirect(302, '/elsewhere')
  })

  app.get('/headers').handle((_request, _validation, response) => {
    response.header('x-first', '1').header('x-second', '2').json({ ok: true })
  })

  return expressApp
}

beforeAll(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'typed-response-'))
  pdfFile = path.join(directory, 'invoice.bin')
  await fs.writeFile(pdfFile, pdf)
})

afterAll(async () => {
  await fs.rm(path.dirname(pdfFile), { recursive: true, force: true })
})

const binaryParser = (
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void
) => {
  const chunks: Buffer[] = []
  res.on('data', (chunk) => chunks.push(chunk))
  res.on('end', () => callback(null, Buffer.concat(chunks)))
}

test.each(['buffer', 'uint8array', 'stream', 'file'])(
  'serves a binary body via %s with the declared content type',
  async (variant) => {
    const response = await supertest(makeApp())
      .get(`/pdf/${variant}`)
      .buffer(true)
      .parse(binaryParser as any)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/^application\/pdf/)
    expect(Buffer.compare(response.body, pdf)).toBe(0)
  }
)

test('a json status of a binary route is served as json', async () => {
  const response = await supertest(makeApp()).get('/pdf/other')

  expect(response.status).toBe(404)
  expect(response.headers['content-type']).toMatch(/^application\/json/)
  expect(response.body).toEqual({ error: 'unknown variant' })
})

test('a missing file reaches the error handling of the application', async () => {
  const response = await supertest(makeApp()).get('/pdf/file-missing')

  expect(response.status).toBe(404)
})

const withErrorHandler = (app: Express.Application) => {
  const errors: Error[] = []

  app.use(
    (
      error: Error,
      _request: Express.Request,
      response: Express.Response,
      _next: Express.NextFunction
    ) => {
      errors.push(error)
      response.status(500).json({ error: 'stream failed' })
    }
  )

  return { app, errors }
}

test('a stream failing before the first byte reaches the error handlers', async () => {
  const { app, errors } = withErrorHandler(makeApp())

  const response = await supertest(app).get('/pdf/stream-failing')

  expect(response.status).toBe(500)
  expect(response.headers['content-type']).toMatch(/^application\/json/)
  expect(response.body).toEqual({ error: 'stream failed' })
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ code: 'ENOENT' })
})

test('a stream failing after the first byte aborts the response and reaches the error handlers', async () => {
  const { app, errors } = withErrorHandler(makeApp())

  await expect(supertest(app).get('/pdf/stream-interrupted')).rejects.toThrow()

  await vi.waitFor(() => expect(errors).toHaveLength(1))
  expect(errors[0].message).toBe('interrupted')
})

test('a client closing the connection destroys the stream without an error', async () => {
  const { app, errors } = withErrorHandler(makeApp())
  const server = app.listen(0)
  await once(server, 'listening')

  const request = http.get({
    port: (server.address() as AddressInfo).port,
    path: '/pdf/stream-endless',
  })
  request.on('error', () => {})
  request.on('response', (response) => response.destroy())

  await vi.waitFor(() => expect(endlessStream?.destroyed).toBe(true))
  server.close()

  expect(errors).toEqual([])
})

test('json bodies are sent by status', async () => {
  const app = makeApp()

  const found = await supertest(app).get('/invoices/1')
  expect(found.status).toBe(200)
  expect(found.body).toEqual({ id: '1' })

  const missing = await supertest(app).get('/invoices/missing')
  expect(missing.status).toBe(404)
  expect(missing.headers['content-type']).toMatch(/^application\/json/)
  expect(missing.body).toEqual({ error: 'not found' })
})

test('text bodies are sent with the declared content type', async () => {
  const app = makeApp()

  const csv = await supertest(app).get('/csv')
  expect(csv.headers['content-type']).toMatch(/^text\/csv/)
  expect(csv.text).toBe('a,b')

  const plain = await supertest(app).get('/plain')
  expect(plain.headers['content-type']).toMatch(/^text\/plain/)
  expect(plain.text).toBe('hello')
})

test('empty responses are sent without a body', async () => {
  const response = await supertest(makeApp()).delete('/invoices')

  expect(response.status).toBe(204)
  expect(response.text).toBe('')
  expect(response.headers['content-type']).toBeUndefined()
})

test('raw is the native express response', async () => {
  const response = await supertest(makeApp()).get('/raw')

  expect(response.status).toBe(302)
  expect(response.headers.location).toBe('/elsewhere')
})

test('headers are set and chainable', async () => {
  const response = await supertest(makeApp()).get('/headers')

  expect(response.headers).toMatchObject({ 'x-first': '1', 'x-second': '2' })
  expect(response.body).toEqual({ ok: true })
})
