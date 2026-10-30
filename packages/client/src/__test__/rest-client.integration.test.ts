import { afterEach, describe, expect, test } from 'vitest'
import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import nock from 'nock'
import {
  BagOfRoutes,
  combine,
  HTTPMethod,
  Route,
  VersionHistory,
  Versioning,
  ze,
  ResponseMap,
  empty,
  json,
} from '@t-rest/core'
import { z } from 'zod'
import { RESTClient } from '../classes/rest-client.js'
import { AxiosHTTPAdapter } from '../classes/axios-http-adapter.js'
import { VersionInjector } from '../classes/version-injector.js'
import { HTTPAdapter } from '../types/http-adapter.js'
import { HTTPResponse } from '../types/http-response.js'
import { RequestConfig } from '../types/request-config.js'

axios.defaults.adapter = 'http'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

type Item = { id: number; name: string }

const itemsBagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    Route.version('2024-01-01')
      .get('/api/items')
      .validate(
        z.object({
          query: z.object({
            page: ze.parseInteger().optional(),
            ids: ze.jsonObject(z.array(z.number())).optional(),
            from: ze.parseDate().optional(),
            search: z.string().optional(),
          }),
        })
      )
      .response<Item[]>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .put('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.object({ name: z.string() }),
        })
      )
      .response<Item>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .patch('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.object({ name: z.string().optional() }),
        })
      )
      .response<Item>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .patch('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.object({ title: z.string() }),
        })
      )
      .response<{ id: number; title: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .delete('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.object({ reason: z.string() }).optional(),
        })
      )
      .responses({ 204: empty() })
  )
  .build()

const usersBagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    Route.version('2024-01-01')
      .post('/api/users')
      .validate(z.object({ body: z.object({ email: z.string() }) }))
      .responses({ 201: json<{ id: number }>() })
  )
  .build()

const bagOfRoutes = combine(itemsBagOfRoutes, usersBagOfRoutes)

class HeaderVersionInjector extends VersionInjector {
  modifyHeaders(headers: Record<string, string | number | boolean>) {
    return { ...headers, 'x-api-version': this.version }
  }
}

class PathVersionInjector extends VersionInjector {
  modifyUrl(url: string) {
    return `/v/${this.version}${url}`
  }
}

type RecordedRequest = {
  method: HTTPMethod
  url: string
  data: unknown
  requestConfig: unknown
}

type RecordingContext = { signal?: AbortSignal; traceId?: string }

// records the arguments t-rest passes to the http adapter
class RecordingHTTPAdapter implements HTTPAdapter<RecordingContext> {
  public readonly requests: RecordedRequest[] = []

  constructor(private readonly statusCode = 200) {}

  async request<TResponses extends ResponseMap>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    _responses: TResponses,
    requestConfig?: RequestConfig & RecordingContext
  ): Promise<HTTPResponse<TResponses>> {
    this.requests.push({ method, url, data, requestConfig })

    return {
      data: { ok: true },
      statusCode: this.statusCode,
    } as HTTPResponse<TResponses>
  }
}

const makeAxiosClient = (version: '2024-01-01' | '2024-03-01' = '2024-01-01') =>
  RESTClient.withVersioning(
    bagOfRoutes,
    version,
    new AxiosHTTPAdapter(axios.create({ baseURL: 'http://localhost' })),
    HeaderVersionInjector
  )

afterEach(() => {
  nock.cleanAll()
})

describe('requests through the axios adapter', () => {
  test('put sends params, body and the version header', async () => {
    const scope = nock('http://localhost')
      .put('/api/items/3', { name: 'chair' })
      .matchHeader('x-api-version', '2024-01-01')
      .reply(200, { id: 3, name: 'chair' })

    const response = await makeAxiosClient().put('/api/items/:itemId', {
      params: { itemId: '3' },
      body: { name: 'chair' },
    })

    expect(response).toEqual({
      data: { id: 3, name: 'chair' },
      statusCode: 200,
    })
    scope.done()
  })

  test('patch uses the route of the client version', async () => {
    const scope = nock('http://localhost')
      .patch('/api/items/3', { title: 'chair' })
      .matchHeader('x-api-version', '2024-03-01')
      .reply(200, { id: 3, title: 'chair' })

    const response = await makeAxiosClient('2024-03-01').patch(
      '/api/items/:itemId',
      { params: { itemId: '3' }, body: { title: 'chair' } }
    )

    expect(response.data).toEqual({ id: 3, title: 'chair' })
    scope.done()
  })

  test('delete is sent without a body', async () => {
    let receivedBody: unknown = 'not called'
    const scope = nock('http://localhost')
      .delete('/api/items/3')
      .reply(204, (_, body) => {
        receivedBody = body
        return ''
      })

    const response = await makeAxiosClient().delete('/api/items/:itemId', {
      params: { itemId: '3' },
      body: { reason: 'duplicate' },
    })

    expect(response.statusCode).toBe(204)
    expect(receivedBody).toBe('')
    scope.done()
  })

  test('post of a combined bag is sent', async () => {
    const scope = nock('http://localhost')
      .post('/api/users', { email: 'jon@doe.com' })
      .reply(201, { id: 1 })

    const response = await makeAxiosClient().post('/api/users', {
      body: { email: 'jon@doe.com' },
    })

    expect(response).toEqual({ data: { id: 1 }, statusCode: 201 })
    scope.done()
  })

  test('query values are serialized like the server parses them', async () => {
    const scope = nock('http://localhost')
      .get('/api/items')
      .query({
        page: '2',
        ids: '[1,2]',
        from: '2024-01-02T00:00:00.000Z',
        search: 'a&b',
      })
      .reply(200, [])

    await makeAxiosClient().get('/api/items', {
      query: {
        page: '2',
        ids: '[1,2]',
        from: new Date('2024-01-02T00:00:00.000Z') as unknown as string,
        search: 'a&b',
        // omitted from the url
        unknown: undefined,
      } as { page: string; ids: string; search: string },
    })

    scope.done()
  })

  test('per call headers are sent next to the version header', async () => {
    const scope = nock('http://localhost')
      .get('/api/items')
      .matchHeader('x-api-version', '2024-01-01')
      .matchHeader('accept-language', 'de')
      .matchHeader('idempotency-key', 'abc')
      .reply(200, [])

    await makeAxiosClient().get('/api/items', {
      query: {},
      headers: { 'accept-language': 'de', 'idempotency-key': 'abc' },
    })

    scope.done()
  })

  test('the version header wins over a per call version header', async () => {
    const scope = nock('http://localhost')
      .get('/api/items')
      .matchHeader('x-api-version', '2024-01-01')
      .reply(200, [])

    await makeAxiosClient().get('/api/items', {
      query: {},
      headers: { 'x-api-version': '2023-01-01' },
    })

    scope.done()
  })

  test.each([400, 404, 500])(
    'a response with status %s rejects with the axios error',
    async (status) => {
      nock('http://localhost')
        .get('/api/items')
        .reply(status, { error: 'failed' })

      const error = await makeAxiosClient()
        .get('/api/items', { query: {} })
        .catch((error: unknown) => error)

      expect(error).toBeInstanceOf(AxiosError)
      expect((error as AxiosError).response?.status).toBe(status)
      expect((error as AxiosError).response?.data).toEqual({ error: 'failed' })
    }
  )

  test('an abort signal passed in the request config cancels the request', async () => {
    nock('http://localhost').get('/api/items').delay(1000).reply(200, [])
    const controller = new AbortController()

    const pendingResponse = makeAxiosClient().get('/api/items', {
      query: {},
      signal: controller.signal,
    })
    controller.abort()

    await expect(pendingResponse).rejects.toMatchObject({
      code: 'ERR_CANCELED',
    })
  })

  test('the axios adapter passes request extras but not the route params to axios', async () => {
    const configs: AxiosRequestConfig[] = []
    const axiosInstance = axios.create({
      baseURL: 'http://localhost',
      adapter: async (config) => {
        configs.push(config)
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      },
    })
    // e.g. an interceptor adding a query param via axios' own `params`
    axiosInstance.interceptors.request.use((config) => ({
      ...config,
      params: { ...config.params, token: 'guest' },
    }))
    const client = RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      new AxiosHTTPAdapter(axiosInstance),
      HeaderVersionInjector
    )

    await client.put('/api/items/:itemId', {
      params: { itemId: '3' },
      body: { name: 'chair' },
      timeout: 1234,
    })

    expect(configs).toHaveLength(1)
    expect(configs[0]).toMatchObject({
      method: 'put',
      url: '/api/items/3',
      timeout: 1234,
      params: { token: 'guest' },
    })
    expect(JSON.parse(configs[0].data)).toEqual({ name: 'chair' })
  })
})

describe('the http adapter contract', () => {
  test('the adapter receives the built url, the body and the whole request input', async () => {
    const adapter = new RecordingHTTPAdapter()
    const client = RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      adapter,
      HeaderVersionInjector
    )
    const controller = new AbortController()

    const response = await client.put('/api/items/:itemId', {
      params: { itemId: '3' },
      body: { name: 'chair' },
      headers: { 'accept-language': 'de' },
      signal: controller.signal,
      traceId: 'trace',
    })

    expect(response).toEqual({ data: { ok: true }, statusCode: 200 })
    expect(adapter.requests).toEqual([
      {
        method: 'PUT',
        url: '/api/items/3',
        data: { name: 'chair' },
        // adapters, e.g. in-process bridges, rely on the whole input
        requestConfig: {
          params: { itemId: '3' },
          body: { name: 'chair' },
          headers: { 'accept-language': 'de', 'x-api-version': '2024-01-01' },
          signal: controller.signal,
          traceId: 'trace',
        },
      },
    ])
  })

  test.each(['get', 'delete'] as const)(
    '%s passes no body to the adapter',
    async (method) => {
      const adapter = new RecordingHTTPAdapter()
      const client = RESTClient.withVersioning(
        bagOfRoutes,
        '2024-01-01',
        adapter,
        HeaderVersionInjector
      )

      if (method === 'get') {
        await client.get('/api/items', { query: { page: '1' } })
      } else {
        await client.delete('/api/items/:itemId', {
          params: { itemId: '1' },
          body: { reason: 'duplicate' },
        })
      }

      expect(adapter.requests[0].data).toBeUndefined()
    }
  )

  test('the adapter response is returned as is', async () => {
    const adapter = new RecordingHTTPAdapter(418)
    const client = RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      adapter,
      HeaderVersionInjector
    )

    await expect(client.get('/api/items', { query: {} })).resolves.toEqual({
      data: { ok: true },
      statusCode: 418,
    })
  })

  test('a version injector can modify the url', async () => {
    const adapter = new RecordingHTTPAdapter()
    const client = RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      adapter,
      PathVersionInjector
    )

    await client.get('/api/items', { query: { page: '1' } })

    expect(adapter.requests[0].url).toBe('/v/2024-01-01/api/items?page=1')
    expect(adapter.requests[0].requestConfig).toMatchObject({ headers: {} })
  })

  test('withVersion creates a client of a newer version', async () => {
    const adapter = new RecordingHTTPAdapter()
    const client = RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      adapter,
      HeaderVersionInjector
    ).withVersion('2024-03-01')

    await client.patch('/api/items/:itemId', {
      params: { itemId: '1' },
      body: { title: 'chair' },
    })

    expect(adapter.requests[0].requestConfig).toMatchObject({
      headers: { 'x-api-version': '2024-03-01' },
    })
  })

  test('an adapter rejecting the request rejects the call', async () => {
    const failingAdapter: HTTPAdapter = {
      request: () => Promise.reject(new Error('unexpected request')),
    }
    const client = RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      failingAdapter,
      HeaderVersionInjector
    )

    await expect(client.get('/api/items', { query: {} })).rejects.toThrow(
      'unexpected request'
    )
  })
})

describe('without versioning', () => {
  const unversionedBagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/api/items/:itemId')
        .validate(z.object({ params: z.object({ itemId: ze.parseInteger() }) }))
        .response<Item>()
    )
    .addRoute(
      Route.post('/api/items')
        .validate(z.object({ body: z.object({ name: z.string() }) }))
        .response<Item>()
    )
    .addRoute(
      Route.delete('/api/items/:itemId')
        .validate(z.object({ params: z.object({ itemId: ze.parseInteger() }) }))
        .response<void>()
    )
    .build()

  test('requests are sent without version', async () => {
    const adapter = new RecordingHTTPAdapter()
    const client = RESTClient.withoutVersioning(unversionedBagOfRoutes, adapter)

    await client.get('/api/items/:itemId', { params: { itemId: '1' } })
    await client.post('/api/items', { body: { name: 'chair' } })
    await client.delete('/api/items/:itemId', { params: { itemId: '2' } })

    expect(
      adapter.requests.map(({ method, url, data, requestConfig }) => ({
        method,
        url,
        data,
        headers: (requestConfig as RequestConfig).headers,
      }))
    ).toEqual([
      { method: 'GET', url: '/api/items/1', data: undefined, headers: {} },
      {
        method: 'POST',
        url: '/api/items',
        data: { name: 'chair' },
        headers: {},
      },
      { method: 'DELETE', url: '/api/items/2', data: undefined, headers: {} },
    ])
  })
})
