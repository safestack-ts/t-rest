import { describe, expect, test } from 'vitest'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

type HandlerResponse = {
  handler: string
  params: Record<string, string>
}

describe('path param aliasing', () => {
  test('aliases work if newer route version is handled first', async () => {
    const bagOfRoutes = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(
        Route.version('2024-01-01')
          .get('/users/:id')
          .validate(z.object({ params: z.strictObject({ id: z.string() }) }))
          .response<HandlerResponse>()
      )
      .addRoute(
        Route.version('2024-02-01')
          .get('/users/:userId')
          .validate(
            z.object({ params: z.strictObject({ userId: z.string() }) })
          )
          .response<HandlerResponse>()
      )
      .build()

    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/users/:userId')
      .version('2024-02-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v2', params })
      })

    app
      .get('/users/:id')
      .version('2024-01-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v1', params })
      })

    const responseV1 = await request(expressApp)
      .get('/users/5')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.OK)

    expect(responseV1.body).toEqual<HandlerResponse>({
      handler: 'v1',
      params: { id: '5' },
    })

    const responseV2 = await request(expressApp)
      .get('/users/5')
      .set('X-API-Version', '2024-02-01')
      .expect(StatusCodes.OK)

    expect(responseV2.body).toEqual<HandlerResponse>({
      handler: 'v2',
      params: { userId: '5' },
    })
  })

  test('path params containing underscores share a single express route', async () => {
    const bagOfRoutes = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(
        Route.version('2024-01-01')
          .get('/users/:user_id')
          .validate(
            z.object({ params: z.strictObject({ user_id: z.string() }) })
          )
          .response<HandlerResponse>()
      )
      .addRoute(
        Route.version('2024-02-01')
          .get('/users/:userId')
          .validate(
            z.object({ params: z.strictObject({ userId: z.string() }) })
          )
          .response<HandlerResponse>()
      )
      .build()

    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/users/:user_id')
      .version('2024-01-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v1', params })
      })

    app
      .get('/users/:userId')
      .version('2024-02-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v2', params })
      })

    const responseV1 = await request(expressApp)
      .get('/users/5')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.OK)

    expect(responseV1.body).toEqual<HandlerResponse>({
      handler: 'v1',
      params: { user_id: '5' },
    })

    const responseV2 = await request(expressApp)
      .get('/users/5')
      .set('X-API-Version', '2024-02-01')
      .expect(StatusCodes.OK)

    expect(responseV2.body).toEqual<HandlerResponse>({
      handler: 'v2',
      params: { userId: '5' },
    })
  })

  test('renamed path params containing underscores are aliased', async () => {
    const bagOfRoutes = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(
        Route.version('2024-01-01')
          .get('/users/:user_id')
          .validate(
            z.object({ params: z.strictObject({ user_id: z.string() }) })
          )
          .response<HandlerResponse>()
      )
      .addRoute(
        Route.version('2024-02-01')
          .get('/users/:customer_id')
          .validate(
            z.object({ params: z.strictObject({ customer_id: z.string() }) })
          )
          .response<HandlerResponse>()
      )
      .build()

    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/users/:user_id')
      .version('2024-01-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v1', params })
      })

    app
      .get('/users/:customer_id')
      .version('2024-02-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v2', params })
      })

    const responseV2 = await request(expressApp)
      .get('/users/5')
      .set('X-API-Version', '2024-02-01')
      .expect(StatusCodes.OK)

    expect(responseV2.body).toEqual<HandlerResponse>({
      handler: 'v2',
      params: { customer_id: '5' },
    })
  })

  test('swapped path param names are aliased correctly', async () => {
    const bagOfRoutes = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(
        Route.version('2024-01-01')
          .get('/pairs/:a/:b')
          .validate(
            z.object({
              params: z.strictObject({ a: z.string(), b: z.string() }),
            })
          )
          .response<HandlerResponse>()
      )
      .addRoute(
        Route.version('2024-02-01')
          .get('/pairs/:b/:a')
          .validate(
            z.object({
              params: z.strictObject({ a: z.string(), b: z.string() }),
            })
          )
          .response<HandlerResponse>()
      )
      .build()

    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/pairs/:a/:b')
      .version('2024-01-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v1', params })
      })

    app
      .get('/pairs/:b/:a')
      .version('2024-02-01')
      .handle((_, { params }, response) => {
        response.status(200).json({ handler: 'v2', params })
      })

    const responseV2 = await request(expressApp)
      .get('/pairs/1/2')
      .set('X-API-Version', '2024-02-01')
      .expect(StatusCodes.OK)

    expect(responseV2.body).toEqual<HandlerResponse>({
      handler: 'v2',
      params: { b: '1', a: '2' },
    })
  })
})

describe('version resolution', () => {
  const initApplication = () => {
    const bagOfRoutes = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(
        Route.version('2024-02-01')
          .get('/users')
          .response<{ version: string }>()
      )
      .addRoute(
        Route.version('2024-03-01')
          .get('/users')
          .response<{ version: string }>()
      )
      .build()

    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/users')
      .version('2024-02-01')
      .handle(({ version: { resolved } }, _, response) => {
        response.status(200).json({ version: resolved })
      })

    app
      .get('/users')
      .version('2024-03-01')
      .handle(({ version: { resolved } }, _, response) => {
        response.status(200).json({ version: resolved })
      })

    return expressApp
  }

  test('empty version header resolves to latest version', async () => {
    const response = await request(initApplication())
      .get('/users')
      .set('X-API-Version', '')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ version: '2024-03-01' })
  })

  test('date version equal to a history entry in another format resolves to that version', async () => {
    const response = await request(initApplication())
      .get('/users')
      .set('X-API-Version', '2024-02-01T00:00:00.000Z')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ version: '2024-02-01' })
  })

  test('version older than any route version responds with bad request', async () => {
    await request(initApplication())
      .get('/users')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.BAD_REQUEST)
  })

  test('version between history entries without compatible route version responds with bad request', async () => {
    await request(initApplication())
      .get('/users')
      .set('X-API-Version', '2024-01-15')
      .expect(StatusCodes.BAD_REQUEST)
  })

  test('invalid date version responds with bad request', async () => {
    await request(initApplication())
      .get('/users')
      .set('X-API-Version', 'not-a-date')
      .expect(StatusCodes.BAD_REQUEST)
  })
})
