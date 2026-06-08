import {
  BagOfRoutes,
  Route,
  versionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import Express from 'express'
import { StatusCodes } from 'http-status-codes'
import request from 'supertest'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'
import { defineMiddleware } from '../utils/define-middleware.js'
import { defineRouterModule } from '../utils/define-router-module.js'

type RequestWithClientId = {
  clientId: string
}

const withClientId = defineMiddleware<ExpressRequest, RequestWithClientId>(
  (request, _response, next) => {
    ;(request as ExpressRequest & RequestWithClientId).clientId = 'client-1'
    next()
  }
)

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

describe('typed router modules without versioning', () => {
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/api/users/me').response<User>())
    .addRoute(
      Route.get('/api/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<User>()
    )
    .addRoute(Route.get('/api/admin/accounts').response<User[]>())
    .build()

  test('mounts modules, applies branch middleware, and keeps sibling branches isolated', async () => {
    const usersModule = defineRouterModule(bagOfRoutes)
      .at('/api/users')
      .withContext<RequestWithClientId>()
      .configure((router) => {
        router.get('/me').handle((request, _validationOutput, response) => {
          response.status(StatusCodes.OK).json({
            id: 1,
            email: `${request.clientId}@email.com`,
          })
        })

        router
          .get('/:userId')
          .handle((_request, { params: { userId } }, response) => {
            response.status(StatusCodes.OK).json({
              id: userId,
              email: `user-${userId}@email.com`,
            })
          })
      })

    const adminModule = defineRouterModule(bagOfRoutes)
      .at('/api/admin')
      .configure((router) => {
        router.get('/accounts').handle((request, _validationOutput, response) => {
          response.status(StatusCodes.OK).json([
            {
              id: 1,
              email:
                'clientId' in request
                  ? `${request.clientId}@email.com`
                  : 'admin@email.com',
            },
          ])
        })
      })

    const expressApp = Express()
    const rootRouter = Express.Router()
    expressApp.use('/api', rootRouter)

    const app = TypedExpressApplication.withoutVersioning(
      rootRouter,
      bagOfRoutes,
      '/api'
    )

    app.branch('/users').use(withClientId).mount(usersModule)
    app.branch('/admin').mount(adminModule)

    const currentUserResponse = await request(expressApp)
      .get('/api/users/me')
      .expect(StatusCodes.OK)

    expect(currentUserResponse.body).toEqual({
      id: 1,
      email: 'client-1@email.com',
    })

    const userResponse = await request(expressApp)
      .get('/api/users/42')
      .expect(StatusCodes.OK)

    expect(userResponse.body).toEqual({
      id: 42,
      email: 'user-42@email.com',
    })

    const adminResponse = await request(expressApp)
      .get('/api/admin/accounts')
      .expect(StatusCodes.OK)

    expect(adminResponse.body).toEqual([
      {
        id: 1,
        email: 'admin@email.com',
      },
    ])
  })

  test('middleware applied before mounting a module does not affect isolated sibling sub-paths', async () => {
    const usersModule = defineRouterModule(bagOfRoutes)
      .at('/api/users')
      .withContext<RequestWithClientId>()
      .configure((router) => {
        router.get('/me').handle((request, _validationOutput, response) => {
          response.status(StatusCodes.OK).json({
            id: 1,
            email: `${request.clientId}@email.com`,
          })
        })
      })

    const adminModule = defineRouterModule(bagOfRoutes)
      .at('/api/admin')
      .configure((router) => {
        router.get('/accounts').handle((request, _validationOutput, response) => {
          response.status(StatusCodes.OK).json([
            {
              id: 1,
              email:
                'clientId' in request
                  ? `${request.clientId}@email.com`
                  : 'isolated@email.com',
            },
          ])
        })
      })

    const expressApp = Express()
    const rootRouter = Express.Router()
    expressApp.use('/api', rootRouter)

    const app = TypedExpressApplication.withoutVersioning(
      rootRouter,
      bagOfRoutes,
      '/api'
    )

    app.branch('/users').use(withClientId).mount(usersModule)
    app.branch('/admin').mount(adminModule)

    const usersResponse = await request(expressApp)
      .get('/api/users/me')
      .expect(StatusCodes.OK)

    expect(usersResponse.body).toEqual({
      id: 1,
      email: 'client-1@email.com',
    })

    const adminResponse = await request(expressApp)
      .get('/api/admin/accounts')
      .expect(StatusCodes.OK)

    expect(adminResponse.body).toEqual([
      {
        id: 1,
        email: 'isolated@email.com',
      },
    ])
  })
})

describe('typed router modules with versioning', () => {
  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01').get('/api/users').response<{
        version: string
        data: User[]
      }>()
    )
    .build()

  test('mounts a versioned module and routes through version selection', async () => {
    const usersModule = defineRouterModule(bagOfRoutes)
      .at('/api/users')
      .configure((router) => {
        router
          .get('/')
          .version('2024-01-01')
          .handle(({ version: { resolved } }, _validationOutput, response) => {
            response.status(StatusCodes.OK).json({
              version: resolved,
              data: [{ id: 1, email: 'me@email.com' }],
            })
          })
      })

    const expressApp = Express()
    const rootRouter = Express.Router()
    expressApp.use('/api', rootRouter)

    const app = TypedExpressApplication.withVersioning(
      rootRouter,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor(),
      '/api'
    )

    app.branch('/users').mount(usersModule)

    const response = await request(expressApp)
      .get('/api/users')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({
      version: '2024-01-01',
      data: [{ id: 1, email: 'me@email.com' }],
    })
  })
})
