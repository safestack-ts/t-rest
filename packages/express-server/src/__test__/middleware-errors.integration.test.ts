import { describe, expect, test } from 'vitest'
import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'
import { defineMiddleware } from '../utils/define-middleware.js'

// note: intentionally not importing 'express-async-errors' so that async
// middleware errors must be forwarded to next() by defineMiddleware itself

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

const failingAsyncMiddleware = defineMiddleware<ExpressRequest, unknown>(
  async () => {
    throw new Error('boom')
  }
)

const errorHandler = (
  err: Error,
  _req: ExpressRequest,
  res: ExpressResponse,
  _next: ExpressNextFunction
) => {
  res.status(500).send({ error: err.message })
}

const bagWithoutVersioning = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/users').response<string>())
  .build()

const bagWithVersioning = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(Route.version('2024-01-01').get('/users').response<string>())
  .build()

describe('defineMiddleware with async errors', () => {
  test('without versioning: route middleware error reaches error handler', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withoutVersioning(
      expressApp,
      bagWithoutVersioning
    )

    app
      .get('/users')
      .middleware(failingAsyncMiddleware)
      .handle((_, __, response) => {
        response.status(200).json('ok')
      })

    expressApp.use(errorHandler)

    const response = await request(expressApp)
      .get('/users')
      .expect(StatusCodes.INTERNAL_SERVER_ERROR)

    expect(response.body).toEqual({ error: 'boom' })
  }, 5000)

  test('without versioning: router middleware error reaches error handler', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withoutVersioning(
      expressApp,
      bagWithoutVersioning
    )

    app
      .use(failingAsyncMiddleware)
      .get('/users')
      .handle((_, __, response) => {
        response.status(200).json('ok')
      })

    expressApp.use(errorHandler)

    const response = await request(expressApp)
      .get('/users')
      .expect(StatusCodes.INTERNAL_SERVER_ERROR)

    expect(response.body).toEqual({ error: 'boom' })
  }, 5000)

  test('with versioning: route middleware error reaches error handler', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagWithVersioning,
      versionHistory,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/users')
      .version('2024-01-01')
      .middleware(failingAsyncMiddleware)
      .handle((_, __, response) => {
        response.status(200).json('ok')
      })

    expressApp.use(errorHandler)

    const response = await request(expressApp)
      .get('/users')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.INTERNAL_SERVER_ERROR)

    expect(response.body).toEqual({ error: 'boom' })
  }, 5000)

  test('with versioning: router middleware error reaches error handler', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagWithVersioning,
      versionHistory,
      new APIVersionHeaderExtractor()
    )

    app
      .use(failingAsyncMiddleware)
      .get('/users')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.status(200).json('ok')
      })

    expressApp.use(errorHandler)

    const response = await request(expressApp)
      .get('/users')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.INTERNAL_SERVER_ERROR)

    expect(response.body).toEqual({ error: 'boom' })
  }, 5000)

  test('async middleware that calls next() continues to the handler', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withoutVersioning(
      expressApp,
      bagWithoutVersioning
    )

    app
      .get('/users')
      .middleware(
        defineMiddleware<ExpressRequest, unknown>(async (_req, _res, next) => {
          await Promise.resolve()
          next()
        })
      )
      .handle((_, __, response) => {
        response.status(200).json('ok')
      })

    const response = await request(expressApp)
      .get('/users')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual('ok')
  }, 5000)
})
