import {
  ResponseWithVersion,
  TestBagOfRoutesWithVersioning,
  User,
  UserWithTags,
} from '@t-rest/testing-utilities'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { DateVersionExtractor } from '../types/date-version-extractor'
import { TypedExpressApplication } from '../classes/typed-express-application'
import {
  ExpressApp,
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts'
import { BagOfRoutes, Route, Versioning, ze } from '@t-rest/core'
import { z } from 'zod'
import { defineMiddleware } from '../utils/define-middleware'
import 'express-async-errors'

const { bagOfRoutes: baseBagOfRoutes, versionHistory } =
  TestBagOfRoutesWithVersioning

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

const initApplication = (expressApp: ExpressApp) => {
  expressApp.use(Express.json())

  const typedExpressApplication = TypedExpressApplication.withVersioning(
    expressApp,
    baseBagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor()
  )
  const userRouter = typedExpressApplication.branch('/users')

  userRouter
    .get('/:userId')
    .version('2024-01-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { params: { userId } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: userId, email: `user-${userId}@email.com` },
        })
      }
    )

  userRouter
    .get('/:userId')
    .version('2024-02-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { params: { userId } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: 42, email: `user-${userId}@email.com`, tags: ['tag1'] },
        })
      }
    )

  userRouter
    .post('/')
    .version('2024-02-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { body: { name } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: 42, email: `${name}@email.com`, tags: [] },
        })
      }
    )

  return typedExpressApplication
}

test('calling route without any version resolves to latest version', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/7487bdc6-f308-4852-ad06-07ff7fb7a349')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<UserWithTags>>({
    data: {
      id: 42,
      email: `user-7487bdc6-f308-4852-ad06-07ff7fb7a349@email.com`,
      tags: ['tag1'],
    },
    version: '2024-02-01',
  })
})

test('calling route with newer version resolves to latest available version of the route', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/7487bdc6-f308-4852-ad06-07ff7fb7a349')
    .set('X-API-Version', '2024-03-01')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<UserWithTags>>({
    data: {
      id: 42,
      email: `user-7487bdc6-f308-4852-ad06-07ff7fb7a349@email.com`,
      tags: ['tag1'],
    },
    version: '2024-02-01',
  })
})

test('calling route with outdated version resolves to outdated version of the route', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/1337')
    .set('X-API-Version', '2024-01-01')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 1337,
      email: `user-1337@email.com`,
    },
    version: '2024-01-01',
  })
})

test('calling route with version in between two history versions resolves to nearest lower version of the route', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/1337')
    .set('X-API-Version', '2024-01-15')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 1337,
      email: `user-1337@email.com`,
    },
    version: '2024-01-01',
  })
})

test('calling versioned route with semantic parameter change both versions are still resolvable', async () => {
  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<ResponseWithVersion<User>>()
    )
    .addRoute(
      Route.version('2024-02-01')
        .get('/users/:userIdentifier')
        .validate(z.object({ params: z.object({ userIdentifier: ze.uuid() }) }))
        .response<ResponseWithVersion<User>>()
    )
    .build()

  const expressApp = Express()

  const typedExpressApplication = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor()
  )

  typedExpressApplication
    .get('/users/:userId')
    .version('2024-01-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { params: { userId } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: userId, email: `user-${userId}@email.com` },
        })
      }
    )

  typedExpressApplication
    .get('/users/:userIdentifier')
    .version('2024-02-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { params: { userIdentifier } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: 42, email: `user-${userIdentifier}@email.com` },
        })
      }
    )

  const responseV20240101 = await request(expressApp)
    .get('/users/1337')
    .set('X-API-Version', '2024-01-01')
    .expect(StatusCodes.OK)

  expect(responseV20240101.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 1337,
      email: `user-1337@email.com`,
    },
    version: '2024-01-01',
  })

  const responseV20240201 = await request(expressApp)
    .get('/users/5042df2b-3760-4bdb-9789-babd5a917d93')
    .set('X-API-Version', '2024-02-01')
    .expect(StatusCodes.OK)

  expect(responseV20240201.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 42,
      email: `user-5042df2b-3760-4bdb-9789-babd5a917d93@email.com`,
    },
    version: '2024-02-01',
  })
})

test('query params and path params are kept separate', async () => {
  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/users/:userId')
        .validate(
          z.object({
            params: z.strictObject({ userId: ze.parseInteger() }),
            query: z.strictObject({ email: z.string() }),
          })
        )
        .response<ResponseWithVersion<User>>()
    )
    .build()

  const expressApp = Express()

  const typedExpressApplication = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor()
  )

  typedExpressApplication
    .get('/users/:userId')
    .version('2024-01-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { params, query },
        response
      ) => {
        expect(params).toEqual({ userId: 1337 })
        expect(query).toEqual({ email: 'test@email.com' })
        response.status(200).json({
          version: resolvedVersion,
          data: { id: 1337, email: `user-1337@email.com` },
        })
      }
    )

  const response = await request(expressApp)
    .get('/users/1337?email=test@email.com')
    .set('X-API-Version', '2024-01-01')
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: { id: 1337, email: `user-1337@email.com` },
    version: '2024-01-01',
  })
})

test.only('middleware in router should abort middleware chain if error is returned', async () => {
  type RequestWithClientId = {
    auth: {
      clientId: number
    }
  }
  const withClientId = defineMiddleware<ExpressRequest, RequestWithClientId>(
    (req, _res, next) => {
      next?.(new Error('ClientId is missing'))
      return
    }
  )

  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/users/:userId')
        .response<ResponseWithVersion<User>>()
    )
    .build()

  const expressApp = Express()

  const typedExpressApplication = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor()
  )

  typedExpressApplication
    .get('/users/:userId')
    .version('2024-01-01')
    .middleware(withClientId)
    .handle(async (__, _, response) => {
      response.status(200).json({
        version: '2024-01-01',
        data: { id: 1337, email: `user-1337@email.com` },
      })
    })

  expressApp.use(
    (
      err: Error,
      req: ExpressRequest,
      res: ExpressResponse,
      _next: ExpressNextFunction
    ) => {
      res.status(500).send({ error: err.message })
    }
  )

  const response = await request(expressApp)
    .get('/users/1337')
    .set('X-API-Version', '2024-01-01')
    .expect(StatusCodes.INTERNAL_SERVER_ERROR)

  expect(response.body).toEqual({ error: 'ClientId is missing' })
})
