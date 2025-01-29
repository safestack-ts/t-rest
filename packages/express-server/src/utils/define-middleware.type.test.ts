import {
  BagOfRoutes,
  demoBagOfRoutes,
  Route,
  versionHistory,
  ze,
} from '@t-rest/core'
import Express from 'express'
import { TypedExpressApplication } from '../classes/typed-express-application'
import { z } from 'zod'
import { User } from '@t-rest/testing-utilities'
import { ExpressRequest } from '../types/express-type-shortcuts'
import { defineMiddleware } from './define-middleware'
import { AssertTrue } from 'conditional-type-checks'

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

namespace _WithoutVersioning {
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

  const userRouter = app.branch('/users')
  const userRouterWithMiddlewares = userRouter.use(withClientId).use(withUser)

  userRouterWithMiddlewares.get('/').handle((context, _, response) => {
    type ContextHasClientIdAndUser = typeof context extends {
      clientId: string
      user: User
    }
      ? true
      : false
    type _test = AssertTrue<ContextHasClientIdAndUser>

    response.status(200).json([])
  })
}

namespace _WithVersioning {
  const expressApp = Express()

  const app = TypedExpressApplication.withVersioning(
    expressApp,
    demoBagOfRoutes,
    versionHistory,
    null as any
  )

  const basketRouter = app.branch('/basket')
  const basketRouterWithMiddlewares = basketRouter
    .use(withClientId)
    .use(withUser)

  basketRouterWithMiddlewares
    .get('/')
    .version('2024-01-01')
    .handle((context, _, response) => {
      type ContextHasClientIdAndUser = typeof context extends {
        clientId: string
        user: User
      }
        ? true
        : false
      type _test = AssertTrue<ContextHasClientIdAndUser>

      response.status(200).json([])
    })
}
