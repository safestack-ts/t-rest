import { describe, expect, test } from 'vitest'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'
import { defineMiddleware } from '../utils/define-middleware.js'

const versionHistory = VersionHistory(['2024-01-01'] as const)

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

type RequestWithTrace = { trace: string[] }

const trace = (name: string) =>
  defineMiddleware<ExpressRequest, RequestWithTrace>((request, _, next) => {
    const requestWithTrace = request as ExpressRequest & RequestWithTrace
    requestWithTrace.trace = [...(requestWithTrace.trace ?? []), name]
    next()
  })

const requireToken = defineMiddleware<ExpressRequest, unknown>(
  (request, response, next) => {
    if (request.header('authorization') !== 'Bearer token') {
      response.status(StatusCodes.UNAUTHORIZED).json({ error: 'unauthorized' })
      return
    }
    next()
  }
)

const traceOf = (request: ExpressRequest) =>
  (request as ExpressRequest & Partial<RequestWithTrace>).trace ?? []

const errorHandler = (
  error: Error,
  _: ExpressRequest,
  response: ExpressResponse,
  __: ExpressNextFunction
) => {
  response
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ error: error.message })
}

// public, private and admin routes of a service, all on branches of '/'
const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/api/baskets/public').response<string[]>()
  )
  .addRoute(
    Route.version('2024-01-01').get('/api/baskets/private').response<string[]>()
  )
  .addRoute(
    Route.version('2024-01-01').get('/api/baskets/admin').response<string[]>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/api/baskets/:basketId')
      .validate(z.object({ params: z.object({ basketId: z.string() }) }))
      .response<{ basketId: string; trace: string[] }>()
  )
  .build()

const makeApplication = (router: Express.Router) =>
  TypedExpressApplication.withVersioning(
    router,
    bagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor(),
    '/api/baskets'
  )

describe('several branches of the same path', () => {
  const initApplication = () => {
    const expressApp = Express()
    const basketsRouter = Express.Router()
    expressApp.use('/api/baskets', basketsRouter)

    const app = makeApplication(basketsRouter)

    const publicBranch = app.branch('/').use(trace('public'))
    const privateBranch = app
      .branch('/')
      .use(trace('private'))
      .use(requireToken)
    const adminBranch = app.branch('/').use(trace('admin'))

    publicBranch
      .get('/public')
      .version('2024-01-01')
      .handle((request, _, response) => {
        response.json(traceOf(request))
      })
    privateBranch
      .get('/private')
      .version('2024-01-01')
      .handle((request, _, response) => {
        response.json(traceOf(request))
      })
    adminBranch
      .get('/admin')
      .version('2024-01-01')
      .handle((request, _, response) => {
        response.json(traceOf(request))
      })

    expressApp.use(errorHandler)

    return expressApp
  }

  test('a route of the first branch only runs the middlewares of its branch', async () => {
    await request(initApplication())
      .get('/api/baskets/public')
      .expect(StatusCodes.OK, ['public'])
  })

  // branches are express routers mounted one after another on the same path,
  // a request for a route of a later branch passes the middlewares of all
  // earlier branches before reaching its own branch
  test('a route of a later branch also runs the middlewares of earlier branches', async () => {
    await request(initApplication())
      .get('/api/baskets/private')
      .set('authorization', 'Bearer token')
      .expect(StatusCodes.OK, ['public', 'private'])
  })

  test('a middleware ending the request blocks the routes of all later branches', async () => {
    const app = initApplication()

    await request(app)
      .get('/api/baskets/private')
      .expect(StatusCodes.UNAUTHORIZED)
    await request(app)
      .get('/api/baskets/admin')
      .expect(StatusCodes.UNAUTHORIZED)
    await request(app)
      .get('/api/baskets/admin')
      .set('authorization', 'Bearer token')
      .expect(StatusCodes.OK, ['public', 'private', 'admin'])
  })

  test('separate applications on separate routers isolate their middlewares', async () => {
    const expressApp = Express()
    const adminRouter = Express.Router()
    const privateRouter = Express.Router()
    // mounted first so that private middlewares do not run for admin routes
    expressApp.use('/api/baskets', adminRouter)
    expressApp.use('/api/baskets', privateRouter)

    makeApplication(adminRouter)
      .branch('/')
      .use(trace('admin'))
      .get('/admin')
      .version('2024-01-01')
      .handle((request, _, response) => {
        response.json(traceOf(request))
      })
    makeApplication(privateRouter)
      .branch('/')
      .use(trace('private'))
      .use(requireToken)
      .get('/private')
      .version('2024-01-01')
      .handle((request, _, response) => {
        response.json(traceOf(request))
      })

    await request(expressApp)
      .get('/api/baskets/admin')
      .expect(StatusCodes.OK, ['admin'])
    await request(expressApp)
      .get('/api/baskets/private')
      .set('authorization', 'Bearer token')
      .expect(StatusCodes.OK, ['admin', 'private'])
  })
})

describe('literal and param routes of the same prefix', () => {
  const initApplication = (order: 'literal-first' | 'param-first') => {
    const expressApp = Express()
    const literalRouter = Express.Router()
    const paramRouter = Express.Router()

    const routers =
      order === 'literal-first'
        ? [literalRouter, paramRouter]
        : [paramRouter, literalRouter]
    routers.forEach((router) => expressApp.use('/api/baskets', router))

    makeApplication(literalRouter)
      .get('/admin')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json(['admin'])
      })
    makeApplication(paramRouter)
      .get('/:basketId')
      .version('2024-01-01')
      .handle((request, { params }, response) => {
        response.json({ basketId: params.basketId, trace: traceOf(request) })
      })

    return expressApp
  }

  test('the literal route wins if its application is mounted first', async () => {
    const app = initApplication('literal-first')

    await request(app)
      .get('/api/baskets/admin')
      .expect(StatusCodes.OK, ['admin'])
    await request(app)
      .get('/api/baskets/42')
      .expect(StatusCodes.OK, { basketId: '42', trace: [] })
  })

  test('the param route shadows the literal route if its application is mounted first', async () => {
    await request(initApplication('param-first'))
      .get('/api/baskets/admin')
      .expect(StatusCodes.OK, { basketId: 'admin', trace: [] })
  })

  test.each([
    ['literal', ['admin']],
    ['param', { basketId: 'admin', trace: [] }],
  ] as const)(
    'within one application the %s route handled first wins',
    async (first, expectedBody) => {
      const expressApp = Express()
      const basketsRouter = Express.Router()
      expressApp.use('/api/baskets', basketsRouter)
      const app = makeApplication(basketsRouter)

      const handleLiteral = () =>
        app
          .get('/admin')
          .version('2024-01-01')
          .handle((_, __, response) => {
            response.json(['admin'])
          })
      const handleParam = () =>
        app
          .get('/:basketId')
          .version('2024-01-01')
          .handle((_, { params }, response) => {
            response.json({ basketId: params.basketId, trace: [] })
          })

      if (first === 'literal') {
        handleLiteral()
        handleParam()
      } else {
        handleParam()
        handleLiteral()
      }

      await request(expressApp)
        .get('/api/baskets/admin')
        .expect(StatusCodes.OK, expectedBody)
    }
  )
})
