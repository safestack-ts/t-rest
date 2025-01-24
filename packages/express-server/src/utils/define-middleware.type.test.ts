import { BagOfRoutes, Route, ze } from '@t-rest/core'
import Express from 'express'
import { TypedExpressApplication } from '../classes/typed-express-application'
import { z } from 'zod'
import { User } from '@t-rest/testing-utilities'
import { ExpressRequest } from '../types/express-type-shortcuts'
import { defineMiddleware } from './define-middleware'
import { AssertTrue } from 'conditional-type-checks'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/users')
      .validate(
        z.object({
          query: z.object({
            page: ze.parseInteger().optional().default(1),
            limit: ze.parseInteger().optional().default(10),
            from: ze.parseDate(),
          }),
        })
      )
      .response<User[]>()
  )
  .build()

const expressApp = Express()

const app = TypedExpressApplication.withoutVersioning(expressApp, bagOfRoutes)

type RequestWithClientId = ExpressRequest & { clientId: string }
type RequestWithUser = ExpressRequest & { user: User }

const withClientId = defineMiddleware<ExpressRequest, RequestWithClientId>(
  (req, _res, next) => {
    ;(req as RequestWithClientId).clientId = '123'
    next()
  }
)

const withUser = defineMiddleware<ExpressRequest, RequestWithUser>(
  (req, _res, next) => {
    ;(req as RequestWithUser).user = { id: 123, email: 'john.doe@example.com' }
    next()
  }
)

const userRouter = app.branch('/users')
const userRouterWithMiddlewares = userRouter.use(withClientId).use(withUser)

userRouterWithMiddlewares.get('/').handle((context, _) => {
  type ContextHasClientIdAndUser = typeof context extends {
    clientId: string
    user: User
  }
    ? true
    : false
  type _test = AssertTrue<ContextHasClientIdAndUser>

  return {
    statusCode: 200,
    data: [],
  }
})
