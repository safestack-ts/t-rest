import {
  BagOfRoutes,
  Route,
  versionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import Express from 'express'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { defineMiddleware } from './define-middleware.js'
import { defineRouterModule } from './define-router-module.js'

type RequestWithClientId = {
  clientId: string
}

const withClientId = defineMiddleware<ExpressRequest, RequestWithClientId>(
  (request, _response, next) => {
    ;(request as ExpressRequest & RequestWithClientId).clientId = '123'
    next()
  }
)

namespace _WithoutVersioning {
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/api/users/me').response<User>())
    .addRoute(
      Route.get('/api/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<User>()
    )
    .addRoute(Route.get('/api/admin/accounts').response<User[]>())
    .build()

  defineRouterModule(bagOfRoutes).at('/api/users')

  // @ts-expect-error
  defineRouterModule(bagOfRoutes).at('/api/payments')

  defineRouterModule(bagOfRoutes)
    .at('/api/users')
    .configure((router) => {
      router.get('/me').handle((_request, _validationOutput, response) => {
        response.status(200).json({ id: 1, email: 'me@email.com' })
      })

      // @ts-expect-error
      router.get('/accounts')
    })

  const usersModule = defineRouterModule(bagOfRoutes)
    .at('/api/users')
    .withContext<RequestWithClientId>()
    .configure((router) => {
      router.get('/me').handle((request, _validationOutput, response) => {
        request.clientId satisfies string

        response.status(200).json({
          id: 1,
          email: `${request.clientId}@email.com`,
        })
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

  const usersBranch = app.branch('/users')

  // @ts-expect-error
  usersBranch.mount(usersModule)

  usersBranch.use(withClientId).mount(usersModule)

  // @ts-expect-error
  app.branch('/admin').mount(usersModule)
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

  const unversionedBagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/api/users/me').response<User>())
    .build()

  const versionedBagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(Route.version('2024-01-01').get('/api/users').response<User[]>())
    .build()

  const unversionedModule = defineRouterModule(unversionedBagOfRoutes)
    .at('/api/users')
    .configure((router) => {
      router.get('/me').handle((_request, _validationOutput, response) => {
        response.status(200).json({ id: 1, email: 'me@email.com' })
      })
    })

  const versionedModule = defineRouterModule(versionedBagOfRoutes)
    .at('/api/users')
    .configure((router) => {
      router
        .get('/')
        .version('2024-01-01')
        .handle((_request, _validationOutput, response) => {
          response.status(200).json([{ id: 1, email: 'me@email.com' }])
        })
    })

  const expressApp = Express()
  const rootRouter = Express.Router()
  expressApp.use('/api', rootRouter)

  const unversionedApp = TypedExpressApplication.withoutVersioning(
    rootRouter,
    unversionedBagOfRoutes,
    '/api'
  )
  const versionedApp = TypedExpressApplication.withVersioning(
    rootRouter,
    versionedBagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor(),
    '/api'
  )

  // @ts-expect-error
  unversionedApp.branch('/users').mount(versionedModule)

  // @ts-expect-error
  versionedApp.branch('/users').mount(unversionedModule)

  versionedApp.branch('/users').mount(versionedModule)
}

