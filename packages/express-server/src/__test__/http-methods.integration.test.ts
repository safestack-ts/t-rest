import { describe, expect, test } from 'vitest'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import {
  BagOfRoutes,
  Route,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
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

const itemValidator = z.object({
  params: z.strictObject({ itemId: ze.parseInteger() }),
  body: z.strictObject({ name: z.string() }),
})

const itemIdValidator = z.object({
  params: z.strictObject({ itemId: ze.parseInteger() }),
})

type Echo = {
  method: string
  params: unknown
  body?: unknown
  version?: string
}

describe('without versioning', () => {
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.put('/api/items/:itemId').validate(itemValidator).response<Echo>()
    )
    .addRoute(
      Route.patch('/api/items/:itemId').validate(itemValidator).response<Echo>()
    )
    .addRoute(
      Route.delete('/api/items/:itemId')
        .validate(itemIdValidator)
        .response<void>()
    )
    .build()

  const initApplication = () => {
    const expressApp = Express()
    const itemsRouter = Express.Router()
    expressApp.use(Express.json())
    expressApp.use('/api/items', itemsRouter)

    const app = TypedExpressApplication.withoutVersioning(
      itemsRouter,
      bagOfRoutes,
      '/api/items'
    )

    app.put('/:itemId').handle((_, { params, body }, response) => {
      response.status(StatusCodes.OK).json({ method: 'PUT', params, body })
    })

    app.patch('/:itemId').handle((_, { params, body }, response) => {
      response.status(StatusCodes.OK).json({ method: 'PATCH', params, body })
    })

    app.delete('/:itemId').handle((_, __, response) => {
      response.status(StatusCodes.NO_CONTENT).end()
    })

    return expressApp
  }

  test.each(['put', 'patch'] as const)(
    '%s receives validated params and body',
    async (method) => {
      const response = await request(initApplication())
        [method]('/api/items/42')
        .send({ name: 'chair' })
        .expect(StatusCodes.OK)

      expect(response.body).toEqual({
        method: method.toUpperCase(),
        params: { itemId: 42 },
        body: { name: 'chair' },
      })
    }
  )

  test.each(['put', 'patch'] as const)(
    '%s rejects an invalid body',
    async (method) => {
      await request(initApplication())
        [method]('/api/items/42')
        .send({ title: 'chair' })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR)
    }
  )

  test('delete responds without content', async () => {
    const response = await request(initApplication())
      .delete('/api/items/42')
      .expect(StatusCodes.NO_CONTENT)

    expect(response.body).toEqual({})
  })

  test('methods of the same path do not shadow each other', async () => {
    const app = initApplication()

    await request(app).get('/api/items/42').expect(StatusCodes.NOT_FOUND)
    await request(app).post('/api/items/42').expect(StatusCodes.NOT_FOUND)
  })
})

describe('with versioning', () => {
  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .put('/api/items/:itemId')
        .validate(itemValidator)
        .response<Echo>()
    )
    .addRoute(
      Route.version('2024-02-01')
        .patch('/api/items/:itemId')
        .validate(itemValidator)
        .response<Echo>()
    )
    .addRoute(
      Route.version('2024-03-01')
        .patch('/api/items/:itemId')
        .validate(
          z.object({
            params: z.strictObject({ itemId: ze.parseInteger() }),
            body: z.strictObject({ title: z.string() }),
          })
        )
        .response<Echo>()
    )
    // the same delete route in three versions
    .addRoute(
      Route.version('2024-01-01')
        .delete('/api/items/:itemId')
        .validate(itemIdValidator)
        .response<Echo>()
    )
    .addRoute(
      Route.version('2024-02-01')
        .delete('/api/items/:itemId')
        .validate(itemIdValidator)
        .response<Echo>()
    )
    .addRoute(
      Route.version('2024-03-01')
        .delete('/api/items/:itemId')
        .validate(itemIdValidator)
        .response<Echo>()
    )
    .build()

  const initApplication = () => {
    const expressApp = Express()
    const itemsRouter = Express.Router()
    expressApp.use(Express.json())
    expressApp.use('/api/items', itemsRouter)

    const app = TypedExpressApplication.withVersioning(
      itemsRouter,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor(),
      '/api/items'
    )

    app
      .put('/:itemId')
      .version('2024-01-01')
      .handle(({ version }, { params, body }, response) => {
        response
          .status(StatusCodes.OK)
          .json({ method: 'PUT', params, body, version: version.resolved })
      })

    app
      .patch('/:itemId')
      .version('2024-02-01')
      .handle(({ version }, { params, body }, response) => {
        response
          .status(StatusCodes.OK)
          .json({ method: 'PATCH', params, body, version: version.resolved })
      })

    app
      .patch('/:itemId')
      .version('2024-03-01')
      .handle(({ version }, { params, body }, response) => {
        response
          .status(StatusCodes.OK)
          .json({ method: 'PATCH', params, body, version: version.resolved })
      })

    for (const version of ['2024-01-01', '2024-02-01', '2024-03-01'] as const) {
      app
        .delete('/:itemId')
        .version(version)
        .handle((request, { params }, response) => {
          response.status(StatusCodes.OK).json({
            method: 'DELETE',
            params,
            version: request.version.resolved,
          })
        })
    }

    return expressApp
  }

  test('put of the initial version is resolved for every later version', async () => {
    const app = initApplication()

    for (const version of ['2024-01-01', '2024-02-15', '2024-03-01']) {
      const response = await request(app)
        .put('/api/items/1')
        .set('x-api-version', version)
        .send({ name: 'chair' })
        .expect(StatusCodes.OK)

      expect(response.body).toEqual({
        method: 'PUT',
        params: { itemId: 1 },
        body: { name: 'chair' },
        version: '2024-01-01',
      })
    }
  })

  test('patch resolves the version with its own validator', async () => {
    const app = initApplication()

    const olderResponse = await request(app)
      .patch('/api/items/1')
      .set('x-api-version', '2024-02-01')
      .send({ name: 'chair' })
      .expect(StatusCodes.OK)
    expect(olderResponse.body).toMatchObject({
      body: { name: 'chair' },
      version: '2024-02-01',
    })

    const latestResponse = await request(app)
      .patch('/api/items/1')
      .send({ title: 'chair' })
      .expect(StatusCodes.OK)
    expect(latestResponse.body).toMatchObject({
      body: { title: 'chair' },
      version: '2024-03-01',
    })

    // the body of the older version is invalid for the latest version
    await request(app)
      .patch('/api/items/1')
      .set('x-api-version', '2024-03-01')
      .send({ name: 'chair' })
      .expect(StatusCodes.INTERNAL_SERVER_ERROR)
  })

  test('patch before its first version responds with bad request', async () => {
    await request(initApplication())
      .patch('/api/items/1')
      .set('x-api-version', '2024-01-01')
      .send({ name: 'chair' })
      .expect(StatusCodes.BAD_REQUEST)
  })

  test.each([
    ['2024-01-01', '2024-01-01'],
    ['2024-01-20', '2024-01-01'],
    ['2024-02-01', '2024-02-01'],
    ['2024-03-01', '2024-03-01'],
    ['2025-01-01', '2024-03-01'],
  ])(
    'delete with version %s resolves to version %s',
    async (requestedVersion, resolvedVersion) => {
      const response = await request(initApplication())
        .delete('/api/items/7')
        .set('x-api-version', requestedVersion)
        .expect(StatusCodes.OK)

      expect(response.body).toEqual({
        method: 'DELETE',
        params: { itemId: 7 },
        version: resolvedVersion,
      })
    }
  )
})
