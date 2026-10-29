import { describe, expect, test } from 'vitest'
import {
  BagOfRoutes,
  Route,
  versionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import Express from 'express'
import { StatusCodes } from 'http-status-codes'
import request from 'supertest'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'

// These tests guard the route paths t-rest registers on the Express router.
// They run against both Express 4 and Express 5 (CI matrix); Express 5 uses
// path-to-regexp 8, which rejects v4-only syntax when a route is registered.

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

const errorHandler = (
  error: Error,
  _request: ExpressRequest,
  response: ExpressResponse,
  _next: ExpressNextFunction
) => {
  response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: error.message,
  })
}

describe('without versioning', () => {
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/api/admin/teams/:teamId/members/:memberId')
        .validate(
          z.object({
            params: z.object({
              teamId: z.string(),
              memberId: ze.parseInteger(),
            }),
          })
        )
        .response<{ teamId: string; memberId: number }>()
    )
    .addRoute(Route.get('/api/admin/teams/latest').response<string>())
    .addRoute(
      Route.get('/api/admin/teams/:teamId')
        .validate(z.object({ params: z.object({ teamId: z.string() }) }))
        .response<{ teamId: string }>()
    )
    .addRoute(
      Route.get('/api/orgs/:orgId/projects/:projectId')
        .validate(
          z.object({
            params: z.object({
              orgId: z.string(),
              projectId: ze.parseInteger(),
            }),
          })
        )
        .response<{ orgId: string; projectId: number }>()
    )
    .addRoute(Route.get('/api/failing').response<never>())
    .build()

  const initApplication = () => {
    const expressApp = Express()
    const apiRouter = Express.Router()
    expressApp.use('/api', apiRouter)

    const app = TypedExpressApplication.withoutVersioning(
      apiRouter,
      bagOfRoutes,
      '/api'
    )
    const teamsRouter = app.branch('/admin').branch('/teams')

    teamsRouter.get('/latest').handle((_, __, response) => {
      response.status(StatusCodes.OK).json('latest')
    })

    teamsRouter.get('/:teamId').handle((_, { params }, response) => {
      response.status(StatusCodes.OK).json(params)
    })

    teamsRouter
      .get('/:teamId/members/:memberId')
      .handle((_, { params }, response) => {
        response.status(StatusCodes.OK).json(params)
      })

    app
      .branch('/orgs')
      .branch('/:orgId/projects')
      .get('/:projectId')
      .handle((_, { params }, response) => {
        response.status(StatusCodes.OK).json(params)
      })

    app.get('/failing').handle(async () => {
      await Promise.resolve()
      throw new Error('handler failed')
    })

    expressApp.use(errorHandler)

    return expressApp
  }

  test('resolves multiple params across nested branches on a prefixed router', async () => {
    const response = await request(initApplication())
      .get('/api/admin/teams/core/members/42')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ teamId: 'core', memberId: 42 })
  })

  test('resolves a static segment next to param segments', async () => {
    const response = await request(initApplication())
      .get('/api/admin/teams/latest')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual('latest')

    const paramResponse = await request(initApplication())
      .get('/api/admin/teams/core')
      .expect(StatusCodes.OK)

    expect(paramResponse.body).toEqual({ teamId: 'core' })
  })

  test('resolves params of a branch path', async () => {
    const response = await request(initApplication())
      .get('/api/orgs/acme/projects/7')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ orgId: 'acme', projectId: 7 })
  })

  test('does not match paths with missing segments', async () => {
    await request(initApplication())
      .get('/api/admin/teams/core/members')
      .expect(StatusCodes.NOT_FOUND)
  })

  test('forwards rejected async handlers to the error middleware', async () => {
    const response = await request(initApplication())
      .get('/api/failing')
      .expect(StatusCodes.INTERNAL_SERVER_ERROR)

    expect(response.body).toEqual({ message: 'handler failed' })
  })
})

describe('with versioning', () => {
  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(Route.version('2024-01-01').get('/api/users').response<string>())
    .addRoute(
      Route.version('2024-01-01')
        .get('/api/users/:userId/posts/:postId')
        .validate(
          z.object({
            params: z.object({
              userId: ze.parseInteger(),
              postId: ze.parseInteger(),
            }),
          })
        )
        .response<{ userId: number; postId: number }>()
    )
    .addRoute(
      Route.version('2024-02-01')
        .get('/api/users/:id/posts/:postId')
        .validate(
          z.object({
            params: z.object({
              id: ze.parseInteger(),
              postId: ze.parseInteger(),
            }),
          })
        )
        .response<{ id: number; postId: number }>()
    )
    .addRoute(
      Route.version('2024-01-01')
        .get('/api/users/:userId/comments/:commentId')
        .validate(
          z.object({
            params: z.object({
              userId: ze.parseInteger(),
              commentId: ze.parseInteger(),
            }),
          })
        )
        .response<{ userId: number; commentId: number }>()
    )
    .build()

  const initApplication = () => {
    const expressApp = Express()
    const usersRouter = Express.Router()
    expressApp.use('/api/users', usersRouter)

    const app = TypedExpressApplication.withVersioning(
      usersRouter,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor(),
      '/api/users'
    )

    // mounted on the router prefix itself, so the registered path is empty
    app
      .get('/')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.status(StatusCodes.OK).json('users')
      })

    app
      .get('/:userId/posts/:postId')
      .version('2024-01-01')
      .handle((_, { params }, response) => {
        response.status(StatusCodes.OK).json(params)
      })

    app
      .get('/:id/posts/:postId')
      .version('2024-02-01')
      .handle((_, { params }, response) => {
        response.status(StatusCodes.OK).json(params)
      })

    app
      .branch('/:userId/comments')
      .get('/:commentId')
      .version('2024-01-01')
      .handle((_, { params }, response) => {
        response.status(StatusCodes.OK).json(params)
      })

    return expressApp
  }

  test('resolves params of a branch path', async () => {
    const response = await request(initApplication())
      .get('/api/users/1/comments/3')
      .set('x-api-version', '2024-01-01')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ userId: 1, commentId: 3 })
  })

  test('resolves a route mounted on the router prefix', async () => {
    const response = await request(initApplication())
      .get('/api/users')
      .set('x-api-version', '2024-01-01')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual('users')
  })

  test('resolves params of the initial version', async () => {
    const response = await request(initApplication())
      .get('/api/users/1/posts/2')
      .set('x-api-version', '2024-01-01')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ userId: 1, postId: 2 })
  })

  test('resolves renamed params of a later version', async () => {
    const response = await request(initApplication())
      .get('/api/users/1/posts/2')
      .set('x-api-version', '2024-02-01')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ id: 1, postId: 2 })
  })
})
