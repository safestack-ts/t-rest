import {
  BagOfRoutes,
  Route,
  versionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'

describe('without versioning', () => {
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/api/users/me').response<User>())
    .addRoute(
      Route.get('/api/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<User>()
    )
    .addRoute(
      Route.get('/api/posts/:postId/comments')
        .validate(z.object({ params: z.object({ postId: ze.parseInteger() }) }))
        .response<{ id: number; text: string }>()
    )
    .build()

  test('mounting on initial path with branching is working', async () => {
    const expressApp = Express()
    const rootRouter = Express.Router()
    expressApp.use('/api', rootRouter)

    const app = TypedExpressApplication.withoutVersioning(
      rootRouter,
      bagOfRoutes,
      '/api'
    )

    const usersRouter = app.branch('/users')
    const postsRouter = app.branch('/posts')

    usersRouter.get('/me').handle((_, __, response) => {
      response.status(200).json({
        id: 1,
        email: 'jon.doe@email.com',
      })
    })

    usersRouter
      .get('/:userId')
      .handle((_, { params: { userId } }, response) => {
        response.status(200).json({
          id: userId,
          email: `user-${userId}@email.com`,
        })
      })

    postsRouter
      .get('/:postId/comments')
      .handle((_, { params: { postId } }, response) => {
        response.status(200).json({
          id: postId,
          text: `comment-${postId}`,
        })
      })

    const response = await request(expressApp)
      .get('/api/users/1')
      .expect((res) =>
        !res.status.toString().startsWith('2') ? console.error(res.body) : 0
      )
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({
      id: 1,
      email: `user-1@email.com`,
    })
  })
})

describe('with versioning', () => {
  class APIVersionHeaderExtractor implements DateVersionExtractor {
    extractVersion(request: ExpressRequest) {
      return request.header('x-api-version')
    }
    parseDate(version: string) {
      return new Date(version)
    }
  }

  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(Route.version('2024-01-01').get('/api/users').response<User[]>())
    .build()

  test('mounting on initial path with branching is working', async () => {
    const expressApp = Express()
    const rootRouter = Express.Router()
    expressApp.use('/api/users', rootRouter)

    const app = TypedExpressApplication.withVersioning(
      rootRouter,
      bagOfRoutes,
      versionHistory,
      new APIVersionHeaderExtractor(),
      '/api/users'
    )

    app
      .get('/')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.status(200).json([{ id: 1, email: 'jon.doe@email.com' }])
      })
  })
})

describe('branching with path params', () => {
  test('without versioning: parent path params are merged into branch', async () => {
    const bagOfRoutes = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/orgs/:orgId/users')
          .validate(z.object({ params: z.object({ orgId: z.string() }) }))
          .response<{ orgId: string }>()
      )
      .build()

    const expressApp = Express()
    const app = TypedExpressApplication.withoutVersioning(
      expressApp,
      bagOfRoutes
    )

    app
      .branch('/orgs/:orgId')
      .get('/users')
      .handle((_, { params: { orgId } }, response) => {
        response.status(200).json({ orgId })
      })

    const response = await request(expressApp)
      .get('/orgs/7/users')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ orgId: '7' })
  })

  test('with versioning: parent path params are merged into branch', async () => {
    class APIVersionHeaderExtractor implements DateVersionExtractor {
      extractVersion(request: ExpressRequest) {
        return request.header('x-api-version')
      }
      parseDate(version: string) {
        return new Date(version)
      }
    }

    const bagOfRoutes = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(
        Route.version('2024-01-01')
          .get('/orgs/:orgId/users')
          .validate(z.object({ params: z.object({ orgId: z.string() }) }))
          .response<{ orgId: string }>()
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
      .branch('/orgs/:orgId')
      .get('/users')
      .version('2024-01-01')
      .handle((_, { params: { orgId } }, response) => {
        response.status(200).json({ orgId })
      })

    const response = await request(expressApp)
      .get('/orgs/7/users')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.OK)

    expect(response.body).toEqual({ orgId: '7' })
  })
})
