import axios, { AxiosError } from 'axios'
import nock from 'nock'
import { afterEach, expect, test } from 'vitest'
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
import { AxiosHTTPAdapter } from '../classes/axios-http-adapter.js'
import { RESTClient } from '../classes/rest-client.js'
import { VersionInjector } from '../classes/version-injector.js'

axios.defaults.adapter = 'http'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/invoices').responses({
      200: json<{ id: number }>(),
      404: json<{ error: string }>(),
    })
  )
  .addRoute(
    Route.get('/pdf').responses({
      200: binary('application/pdf'),
      201: text('text/csv'),
      204: empty(),
      404: json<{ error: string }>(),
    })
  )
  .addRoute(
    Route.get('/csv').responses({
      200: text('text/csv'),
      404: json<{ error: string }>(),
    })
  )
  .build()

const adapter = new AxiosHTTPAdapter(
  axios.create({ baseURL: 'http://localhost' })
)
const client = RESTClient.withoutVersioning(bagOfRoutes, adapter)

// the package is free of node types
declare const Buffer: { from(data: Uint8Array): object }

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0x00])

afterEach(() => {
  nock.cleanAll()
})

test('a declared error status resolves', async () => {
  nock('http://localhost').get('/invoices').reply(404, { error: 'not found' })

  await expect(client.get('/invoices')).resolves.toEqual({
    data: { error: 'not found' },
    statusCode: 404,
  })
})

test('an undeclared status rejects', async () => {
  nock('http://localhost').get('/invoices').reply(500, { error: 'failed' })

  const error = await client.get('/invoices').catch((error) => error)

  expect(error).toBeInstanceOf(AxiosError)
  expect(error.response.status).toBe(500)
  expect(error.response.data).toEqual({ error: 'failed' })
})

test('an undeclared success status rejects', async () => {
  nock('http://localhost').get('/invoices').reply(201, { id: 1 })

  await expect(client.get('/invoices')).rejects.toBeInstanceOf(AxiosError)
})

test('binary bodies are received as array buffer', async () => {
  nock('http://localhost')
    .get('/pdf')
    .reply(200, Buffer.from(pdf), { 'content-type': 'application/pdf' })

  const response = await client.get('/pdf')

  expect(response.data).toBeInstanceOf(ArrayBuffer)
  expect(new Uint8Array(response.data as ArrayBuffer)).toEqual(pdf)
})

test('json statuses of binary routes are decoded', async () => {
  nock('http://localhost').get('/pdf').reply(404, { error: 'not found' })

  await expect(client.get('/pdf')).resolves.toEqual({
    data: { error: 'not found' },
    statusCode: 404,
  })
})

test('text statuses of binary routes are decoded', async () => {
  nock('http://localhost').get('/pdf').reply(201, 'a,b')

  await expect(client.get('/pdf')).resolves.toEqual({
    data: 'a,b',
    statusCode: 201,
  })
})

test('empty statuses have no data', async () => {
  nock('http://localhost').get('/pdf').reply(204)

  await expect(client.get('/pdf')).resolves.toEqual({
    data: undefined,
    statusCode: 204,
  })
})

test('text bodies stay text, even when they look like json', async () => {
  nock('http://localhost').get('/csv').reply(200, '123')

  await expect(client.get('/csv')).resolves.toEqual({
    data: '123',
    statusCode: 200,
  })
})

test('json statuses of text routes are decoded', async () => {
  nock('http://localhost').get('/csv').reply(404, { error: 'not found' })

  await expect(client.get('/csv')).resolves.toEqual({
    data: { error: 'not found' },
    statusCode: 404,
  })
})

test('the request config overrides the status and response handling', async () => {
  nock('http://localhost').get('/invoices').reply(500, 'failed')

  await expect(
    client.get('/invoices', {
      validateStatus: () => true,
      responseType: 'text',
    })
  ).resolves.toEqual({ data: 'failed', statusCode: 500 })
})

test('versioned clients use the responses of the resolved route version', async () => {
  const versionHistory = VersionHistory([
    '2024-01-01',
    '2024-02-01',
    '2024-03-01',
  ] as const)
  const versionedRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/invoices')
        .responses({ 200: json<{ v: 1 }>() })
    )
    .addRoute(
      Route.version('2024-03-01')
        .get('/invoices')
        .responses({ 200: json<{ v: 3 }>(), 404: json<{ error: string }>() })
    )
    .build()

  class NoopInjector extends VersionInjector {}

  const scope = nock('http://localhost')
    .get('/invoices')
    .times(2)
    .reply(404, { error: 'not found' })

  const inherited = RESTClient.withVersioning(
    versionedRoutes,
    '2024-02-01',
    adapter,
    NoopInjector
  )

  await expect(inherited.get('/invoices')).rejects.toBeInstanceOf(AxiosError)
  await expect(
    inherited.withVersion('2024-03-01').get('/invoices')
  ).resolves.toEqual({ data: { error: 'not found' }, statusCode: 404 })
  scope.done()
})
