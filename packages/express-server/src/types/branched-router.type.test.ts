import {
  BagOfRoutes,
  Route,
  versionHistory,
  Versioning,
  ze,
} from '@t-rest/core'

import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'
import Express from 'express'
import { TypedExpressApplication } from '../classes/typed-express-application'
import { BranchedRouter } from './branched-router'
import { defineMiddleware } from '../utils/define-middleware'
import { ExpressRequest } from './express-type-shortcuts'
import { DateVersionExtractor } from './date-version-extractor'

namespace _WithoutVersioning {
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/api/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<User>()
    )
    .addRoute(
      Route.get('/api/users/:userId/posts/:postId')
        .validate(
          z.object({
            params: z.object({
              userId: ze.parseInteger(),
              postId: ze.parseInteger(),
            }),
          })
        )
        .response<{ id: number; text: string }>()
    )
    .build()

  type RequestWithClientId = ExpressRequest & { clientId: number }
  const withClientId = defineMiddleware<ExpressRequest, RequestWithClientId>(
    (req, _res, next) => {
      ;(req as RequestWithClientId).clientId = 123
      next()
    }
  )

  const expressApp = Express()
  const rootRouter = Express.Router()
  expressApp.use('/api', rootRouter)

  const app = TypedExpressApplication.withoutVersioning(
    rootRouter,
    bagOfRoutes,
    '/api'
  )

  const usersRouter = app.branch('/users')

  const shouldAcceptUsersRouter = (
    _router: BranchedRouter<typeof app, '/users'>
  ) => undefined
  shouldAcceptUsersRouter(usersRouter)

  const shouldAcceptUsersRouterWithMiddleware = (
    _router: BranchedRouter<typeof app, '/users', { clientId: number }>
  ) => undefined
  // @ts-expect-error
  shouldAcceptUsersRouterWithMiddleware(usersRouter)
  const usersRouterWithMiddleware = usersRouter.use(withClientId)
  shouldAcceptUsersRouterWithMiddleware(usersRouterWithMiddleware)

  const userPostsRouter = usersRouter.branch('/posts')
  const shouldAcceptUserPostsRouter = (
    _router: BranchedRouter<typeof usersRouter, '/posts'>
  ) => undefined
  shouldAcceptUserPostsRouter(userPostsRouter)
}

namespace _WithVersioning {
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

  type App = typeof app

  const UsersRouter = (router: BranchedRouter<App, '/'>) => {
    router
      .get('/')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.status(200).json([{ id: 1, email: 'jon.doe@email.com' }])
      })
  }

  UsersRouter(app)
}
