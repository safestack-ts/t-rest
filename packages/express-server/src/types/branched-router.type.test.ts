import { BagOfRoutes, Route, ze } from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'
import Express from 'express'
import { TypedExpressApplication } from '../classes/typed-express-application'
import { BranchedRouter } from './branched-router'
import { defineMiddleware } from '../utils/define-middleware'
import { ExpressRequest } from './express-type-shortcuts'

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
