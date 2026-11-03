import { Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { Readable } from 'node:stream'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import axios from 'axios'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import {
  BagOfRoutes,
  binary,
  empty,
  json,
  Route,
  text,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { RESTClient } from '@t-rest/client'
import { AxiosHTTPAdapter } from '@t-rest/client/axios'
import {
  ExpressRequest,
  TypedExpressApplication,
  VersionExtractor,
} from '@t-rest/express-server'
import Express from 'express'
import { z } from 'zod'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { VersionInjector } from '../classes/version-injector.js'

type Invoice = { id: string }
type Failure = { error: string }

const idValidator = z.object({ params: z.object({ id: z.string() }) })

const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0x00])
const invalidUtf8 = Buffer.from([0xff, 0x00, 0x41])

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/invoices/:id').validate(idValidator).responses({
      200: json<Invoice>(),
      404: json<Failure>(),
    })
  )
  .addRoute(
    Route.get('/invoices/:id/pdf')
      .validate(idValidator)
      .responses({
        200: binary('application/pdf'),
        404: json<Failure>(),
      })
  )
  .addRoute(
    Route.get('/invoices/:id/stream')
      .validate(idValidator)
      .responses({
        200: binary('application/pdf'),
      })
  )
  .addRoute(
    Route.get('/invoices/:id/csv')
      .validate(idValidator)
      .responses({ 200: text('text/csv') })
  )
  .addRoute(
    Route.get('/invoices/:id/xml')
      .validate(idValidator)
      .responses({ 200: text('application/xml') })
  )
  .addRoute(
    Route.get('/invoices/:id/raw')
      .validate(idValidator)
      .responses({ 200: binary('text/plain'), 404: json<Failure>() })
  )
  .addRoute(
    Route.delete('/invoices/:id')
      .validate(idValidator)
      .responses({ 204: empty() })
  )
  .build()

const makeApp = () => {
  const app = TypedExpressApplication.withoutVersioning(Express(), bagOfRoutes)

  app.get('/invoices/:id').handle((_request, { params }, response) => {
    if (params.id === 'missing') {
      response.status(404).json({ error: 'not found' })
    } else {
      response.status(200).json({ id: params.id })
    }
  })
  app.get('/invoices/:id/pdf').handle((_request, { params }, response) => {
    if (params.id === 'missing') {
      response.status(404).json({ error: 'not found' })
    } else {
      response.status(200).send(pdf)
    }
  })
  app.get('/invoices/:id/stream').handle((_request, _validation, response) => {
    response.status(200).stream(Readable.from([pdf]))
  })
  app.get('/invoices/:id/csv').handle((_request, _validation, response) => {
    response.status(200).send('a,b')
  })
  app.get('/invoices/:id/xml').handle((_request, _validation, response) => {
    response.status(200).send('<root/>')
  })
  app.get('/invoices/:id/raw').handle((_request, { params }, response) => {
    if (params.id === 'missing') {
      response.status(404).json({ error: 'not found' })
    } else {
      response.status(200).send(invalidUtf8)
    }
  })
  app.delete('/invoices/:id').handle((_request, _validation, response) => {
    response.status(204).end()
  })

  return app
}

describe('client against the server', () => {
  let server: Server
  const params = { id: '1' }

  const makeClient = () =>
    RESTClient.withoutVersioning(
      bagOfRoutes,
      new AxiosHTTPAdapter(
        axios.create({
          adapter: 'http',
          baseURL: `http://localhost:${(server.address() as AddressInfo).port}`,
        })
      )
    )

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = (makeApp().expressApp as Express.Application).listen(0, () =>
        resolve()
      )
    })
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  test.each(['pdf', 'stream'] as const)(
    'receives the %s route as binary',
    async (route) => {
      const response = await makeClient().get(`/invoices/:id/${route}`, {
        params,
      })

      expect(response.statusCode).toBe(200)
      expect(response.data).toBeInstanceOf(ArrayBuffer)
      expect(Buffer.from(response.data as ArrayBuffer).equals(pdf)).toBe(true)
    }
  )

  test('a declared 404 resolves with the json error body', async () => {
    const response = await makeClient().get('/invoices/:id', {
      params: { id: 'missing' },
    })

    expect(response).toMatchObject({
      data: { error: 'not found' },
      statusCode: 404,
    })
  })

  test('a declared 404 of a binary route resolves as json', async () => {
    const response = await makeClient().get('/invoices/:id/pdf', {
      params: { id: 'missing' },
    })

    expect(response).toMatchObject({
      data: { error: 'not found' },
      statusCode: 404,
    })
  })
})

describe('supertest adapter', () => {
  const adapter = () => SupertestAdapter.withoutVersioning(makeApp())
  const params = { id: '1' }

  test('narrows the body by status', async () => {
    const response = await adapter().get('/invoices/:id', { params })

    type _status = AssertTrue<IsExact<typeof response.status, 200 | 404>>

    if (response.status === 200) {
      type _body = AssertTrue<IsExact<typeof response.body, Invoice>>
    } else {
      type _body = AssertTrue<IsExact<typeof response.body, Failure>>
    }

    expect(response.body).toEqual({ id: '1' })
  })

  test('binary bodies are buffers', async () => {
    const response = await adapter().get('/invoices/:id/pdf', { params })

    expect(response.status).toBe(200)

    if (response.status === 200) {
      type _body = AssertTrue<IsExact<typeof response.body, Buffer>>
      expect(response.body.equals(pdf)).toBe(true)
    }
  })

  test('text bodies are strings', async () => {
    const response = await adapter().get('/invoices/:id/csv', { params })

    type _body = AssertTrue<IsExact<typeof response.body, string>>

    expect(response.body).toBe('a,b')
  })

  test('text bodies of a non text media type are strings', async () => {
    const response = await adapter().get('/invoices/:id/xml', { params })

    type _body = AssertTrue<IsExact<typeof response.body, string>>

    expect(response.type).toBe('application/xml')
    expect(response.body).toBe('<root/>')
  })

  test('binary bodies of a text media type keep their bytes', async () => {
    const response = await adapter().get('/invoices/:id/raw', { params })

    expect(response.status).toBe(200)
    expect(response.type).toBe('text/plain')

    if (response.status === 200) {
      type _body = AssertTrue<IsExact<typeof response.body, Buffer>>
      expect(Buffer.isBuffer(response.body)).toBe(true)
      expect(response.body.equals(invalidUtf8)).toBe(true)
    }
  })

  test('a json status of a binary route is parsed as json', async () => {
    const response = await adapter().get('/invoices/:id/raw', {
      params: { id: 'missing' },
    })

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'not found' })
  })

  test('empty responses have an empty body', async () => {
    const response = await adapter().delete('/invoices/:id', { params })

    type _status = AssertTrue<IsExact<typeof response.status, 204>>

    expect(response.status).toBe(204)
    expect(response.body).toEqual({})
  })
})

describe('supertest adapter with versioning', () => {
  const versionHistory = VersionHistory([
    '2024-01-01',
    '2024-02-01',
    '2024-03-01',
  ] as const)

  class HeaderVersionExtractor implements VersionExtractor {
    extractVersion(request: ExpressRequest) {
      return request.header('x-api-version')
    }
  }

  class HeaderVersionInjector extends VersionInjector {
    modifyHeaders(
      headers: Record<string, string | number | boolean>,
      version: string
    ) {
      return { ...headers, 'x-api-version': version }
    }
  }

  const versionedBag = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/report')
        .responses({ 200: text('application/xml') })
    )
    .addRoute(
      Route.version('2024-02-01')
        .get('/report')
        .responses({ 200: binary('text/plain') })
    )
    .build()

  const adapter = () => {
    const app = TypedExpressApplication.withVersioning(
      Express(),
      versionedBag,
      versionHistory,
      new HeaderVersionExtractor()
    )

    app
      .get('/report')
      .version('2024-01-01')
      .handle((_request, _validation, response) => {
        response.status(200).send('<root/>')
      })
    app
      .get('/report')
      .version('2024-02-01')
      .handle((_request, _validation, response) => {
        response.status(200).send(invalidUtf8)
      })

    return SupertestAdapter.withVersioning(app, new HeaderVersionInjector())
  }

  test('decodes by the descriptor of the requested version', async () => {
    const response = await adapter().get('/report', '2024-01-01', {})

    type _body = AssertTrue<IsExact<typeof response.body, string>>

    expect(response.body).toBe('<root/>')
  })

  test('decodes by the descriptor of the version a later one resolves to', async () => {
    const response = await adapter().get('/report', '2024-03-01', {})

    type _body = AssertTrue<IsExact<typeof response.body, Buffer>>

    expect(Buffer.isBuffer(response.body)).toBe(true)
    expect((response.body as Buffer).equals(invalidUtf8)).toBe(true)
  })
})
