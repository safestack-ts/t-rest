import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  BagOfRoutes,
  Route,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import {
  DateVersionExtractor,
  ExpressRequest,
  TypedExpressApplication,
} from '@t-rest/express-server'
import { z } from 'zod'
import Express from 'express'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { VersionInjector } from '../classes/version-injector.js'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

class HeaderVersionExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
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

class PathVersionInjector extends VersionInjector {
  modifyUrl(url: string, version: string) {
    return `/v/${version}${url}`
  }
}

type Echo = {
  method: string
  version: string
  params?: unknown
  query?: unknown
  body?: unknown
  headers: Record<string, string | undefined>
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/api/items')
      .validate(
        z.object({
          query: z.object({
            page: ze.parseInteger().optional(),
            ids: ze.jsonObject(z.array(z.number())).optional(),
          }),
        })
      )
      .response<Echo>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/api/items')
      .validate(z.object({ body: z.strictObject({ name: z.string() }) }))
      .response<Echo>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .put('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.strictObject({ name: z.string() }),
        })
      )
      .response<Echo>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .patch('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.strictObject({ name: z.string() }),
        })
      )
      .response<Echo>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .patch('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.strictObject({ title: z.string() }),
        })
      )
      .response<{ title: string; version: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .delete('/api/items/:itemId')
      .validate(
        z.object({
          params: z.object({ itemId: ze.parseInteger() }),
          body: z.unknown().optional(),
        })
      )
      .response<Echo>()
  )
  .build()

const makeApplication = () => {
  const expressApp = Express()
  expressApp.use(Express.json())

  const app = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    new HeaderVersionExtractor()
  )

  const echo = (
    method: string,
    request: ExpressRequest & { version: { resolved: string } },
    input: { params?: unknown; query?: unknown; body?: unknown }
  ): Echo => ({
    method,
    version: request.version.resolved,
    ...input,
    headers: {
      channel: request.header('x-channel'),
      language: request.header('accept-language'),
    },
  })

  app
    .get('/api/items')
    .version('2024-01-01')
    .handle((request, { query }, response) => {
      response.json(echo('GET', request, { query }))
    })
  app
    .post('/api/items')
    .version('2024-01-01')
    .handle((request, { body }, response) => {
      response.status(201).json(echo('POST', request, { body }))
    })
  app
    .put('/api/items/:itemId')
    .version('2024-01-01')
    .handle((request, { params, body }, response) => {
      response.json(echo('PUT', request, { params, body }))
    })
  app
    .patch('/api/items/:itemId')
    .version('2024-02-01')
    .handle((request, { params, body }, response) => {
      response.json(echo('PATCH', request, { params, body }))
    })
  app
    .patch('/api/items/:itemId')
    .version('2024-03-01')
    .handle((request, { body }, response) => {
      response.json({ title: body.title, version: request.version.resolved })
    })
  app
    .delete('/api/items/:itemId')
    .version('2024-01-01')
    .handle((request, { params, body }, response) => {
      response.json(echo('DELETE', request, { params, body }))
    })

  return app
}

const makeAdapter = (
  headers: Record<string, string> = { 'x-channel': 'web' }
) =>
  SupertestAdapter.withVersioning(
    makeApplication(),
    new HeaderVersionInjector(),
    { headers }
  )

afterEach(() => {
  vi.restoreAllMocks()
})

describe('requests', () => {
  test('get sends the query and the version of the call', async () => {
    const { body } = await makeAdapter().get('/api/items', '2024-01-01', {
      query: { page: 2, ids: JSON.stringify([1, 2]) },
      expect: { status: 200, headers: { 'content-type': /application\/json/ } },
    })

    type _body = AssertTrue<IsExact<typeof body, Echo>>

    expect(body).toEqual({
      method: 'GET',
      version: '2024-01-01',
      query: { page: 2, ids: [1, 2] },
      headers: { channel: 'web' },
    })
  })

  test('post sends the body', async () => {
    const response = await makeAdapter().post('/api/items', '2024-01-01', {
      body: { name: 'chair' },
      expect: { status: 201 },
    })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      method: 'POST',
      body: { name: 'chair' },
    })
  })

  test('put sends params and body', async () => {
    const { body } = await makeAdapter().put(
      '/api/items/:itemId',
      '2024-01-01',
      {
        params: { itemId: 3 },
        body: { name: 'chair' },
        expect: { status: 200 },
      }
    )

    expect(body).toMatchObject({
      method: 'PUT',
      params: { itemId: 3 },
      body: { name: 'chair' },
    })
  })

  test('patch calls the route of the given version', async () => {
    const adapter = makeAdapter()

    const older = await adapter.patch('/api/items/:itemId', '2024-02-01', {
      params: { itemId: 3 },
      body: { name: 'chair' },
      expect: { status: 200 },
    })
    expect(older.body).toMatchObject({ method: 'PATCH', version: '2024-02-01' })

    const latest = await adapter.patch('/api/items/:itemId', '2024-03-01', {
      params: { itemId: 3 },
      body: { title: 'chair' },
      expect: { status: 200 },
    })
    type _latestBody = AssertTrue<
      IsExact<typeof latest.body, { title: string; version: string }>
    >
    expect(latest.body).toEqual({ title: 'chair', version: '2024-03-01' })
  })

  test('delete is sent without a body', async () => {
    const { body } = await makeAdapter().delete(
      '/api/items/:itemId',
      '2024-01-01',
      {
        params: { itemId: 3 },
        body: { reason: 'duplicate' },
        expect: { status: 200 },
      }
    )

    expect(body).toMatchObject({ method: 'DELETE', params: { itemId: 3 } })
    expect(body).not.toHaveProperty('body.reason')
  })
})

describe('headers', () => {
  test('default headers are sent with every request', async () => {
    const { body } = await makeAdapter({
      'x-channel': 'web',
      'accept-language': 'de',
    }).get('/api/items', '2024-01-01', { query: {} })

    expect(body.headers).toEqual({ channel: 'web', language: 'de' })
  })

  test('per call headers are merged into and win over default headers', async () => {
    const { body } = await makeAdapter({
      'x-channel': 'web',
      'accept-language': 'de',
    }).get('/api/items', '2024-01-01', {
      query: {},
      headers: { 'x-channel': 'app' },
    })

    expect(body.headers).toEqual({ channel: 'app', language: 'de' })
  })

  test('the version injector header wins over a per call version header', async () => {
    const { body } = await makeAdapter().patch(
      '/api/items/:itemId',
      '2024-02-01',
      {
        params: { itemId: 1 },
        body: { name: 'chair' },
        headers: { 'x-api-version': '2024-03-01' },
        expect: { status: 200 },
      }
    )

    expect(body).toMatchObject({ version: '2024-02-01' })
  })

  test('a version injector can modify the url', async () => {
    const expressApp = Express()
    expressApp.use(Express.json())
    // moves the version of the url into the version header
    expressApp.use((request, _, next) => {
      const match = request.url.match(/^\/v\/([^/]+)(\/.*)$/)
      if (match) {
        request.headers['x-api-version'] = match[1]
        request.url = match[2]
      }
      next()
    })
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      new HeaderVersionExtractor()
    )
    app
      .patch('/api/items/:itemId')
      .version('2024-02-01')
      .handle((request, _, response) => {
        response.json({
          method: 'PATCH',
          version: request.version.resolved,
          headers: {},
        })
      })

    const adapter = SupertestAdapter.withVersioning(
      app,
      new PathVersionInjector()
    )
    const response = await adapter.patch('/api/items/:itemId', '2024-02-01', {
      params: { itemId: 1 },
      body: { name: 'chair' },
      expect: { status: 200 },
    })

    const { req } = response as unknown as { req: { path: string } }
    expect(req.path).toBe('/v/2024-02-01/api/items/1')
    expect(response.body).toMatchObject({ version: '2024-02-01' })
  })
})

describe('expectations', () => {
  test('an unexpected status fails the request and logs the response body', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      makeAdapter().post('/api/items', '2024-01-01', {
        body: { title: 'chair' } as unknown as { name: string },
        expect: { status: 201 },
      })
    ).rejects.toThrow(/expected 201 "Created", got 500/)

    expect(consoleError).toHaveBeenCalledTimes(1)
    // express' default error page is logged as text
    expect(String(consoleError.mock.calls[0][0])).toContain(
      '<title>Error</title>'
    )
  })

  test('an expected error status passes', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await makeAdapter().patch(
      '/api/items/:itemId',
      '2024-01-01' as '2024-02-01',
      {
        params: { itemId: 1 },
        body: { name: 'chair' },
        expect: { status: 400 },
      }
    )

    expect(response.status).toBe(400)
    expect(consoleError).not.toHaveBeenCalled()
  })

  test('an unexpected header fails the request', async () => {
    await expect(
      makeAdapter().get('/api/items', '2024-01-01', {
        query: {},
        expect: { headers: { 'content-type': /text\/html/ } },
      })
    ).rejects.toThrow(/content-type/)
  })

  test('without expectations the response is returned for any status', async () => {
    const response = await makeAdapter().get('/api/items', '2024-01-01', {
      query: { page: 'abc' as unknown as number },
    })

    expect(response.status).toBe(500)
  })
})
