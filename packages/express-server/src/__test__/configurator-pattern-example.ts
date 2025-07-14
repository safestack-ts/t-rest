// Example demonstrating the new configurator pattern API
// This shows the exact pattern requested by the user

import { BagOfRoutes, Route, ze } from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application'
import Express from 'express'
import { defineMiddleware } from '../utils/define-middleware'
import { ExpressRequest } from '../types/express-type-shortcuts'

// Example route definitions
const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/api/users/me').response<User>())
  .addRoute(
    Route.get('/api/users/:userId')
      .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
      .response<User>()
  )
  .addRoute(
    Route.get('/api/admin/accounts').response<{ id: number; name: string }[]>()
  )
  .addRoute(
    Route.get('/api/admin/addresses').response<
      { id: number; street: string }[]
    >()
  )
  .addRoute(
    Route.get('/api/admin/persons').response<{ id: number; name: string }[]>()
  )
  .build()

type RequestWithAdminAuth = ExpressRequest & {
  admin: {
    id: string
  }
}

type RequestWithPoolAndClientIds = ExpressRequest & {
  poolId: number
  clientId: number
}

// Example middleware
const withAdminAuthentication = defineMiddleware<
  ExpressRequest,
  RequestWithAdminAuth
>((req, res, next) => {
  ;(req as RequestWithAdminAuth).admin = {
    id: 'admin',
  }
  next()
})

const withAdminPoolAndClientIds = defineMiddleware<
  ExpressRequest,
  RequestWithPoolAndClientIds
>((req, res, next) => {
  ;(req as RequestWithPoolAndClientIds).poolId = 1
  ;(req as RequestWithPoolAndClientIds).clientId = 1
  next()
})

// Example router configuration functions
const CurrentUserRouterAdmin = (args: any) => (router: any) => {
  // Configure current user routes
  console.log('Configuring current user routes with args:', args)
}

const AddressRouterAdmin = (args: any) => (router: any) => {
  // Configure address routes
  console.log('Configuring address routes with args:', args)
}

const PersonRouterAdmin = (args: any) => (router: any) => {
  // Configure person routes
  console.log('Configuring person routes with args:', args)
}

const AccountRouterAdmin = (args: any) => (router: any) => {
  // Configure account routes
  console.log('Configuring account routes with args:', args)
}

const AdminAccountRouter = (args: any) => (router: any) => {
  // Configure admin account routes
  console.log('Configuring admin account routes with args:', args)
}

// Example usage - this is the exact pattern the user requested
export function setupAdminRoutes() {
  const expressApp = Express()
  const rootRouter = Express.Router()
  expressApp.use('/api', rootRouter)

  const accountsExpressAdminApplication =
    TypedExpressApplication.withoutVersioning(rootRouter, bagOfRoutes, '/api')

  const args = {
    prisma: {
      /* mock prisma client */
    },
    // other arguments
  }

  // This is the exact API pattern the user requested:
  accountsExpressAdminApplication
    .branch('/')
    .use(withAdminAuthentication)
    .use(withAdminPoolAndClientIds)
    .router((branch) => {
      CurrentUserRouterAdmin(args)(branch)
      AddressRouterAdmin(args)(branch)
      PersonRouterAdmin(args)(branch)
      AccountRouterAdmin(args)(branch)
      AdminAccountRouter(args)(branch)
    })

  return expressApp
}

// Alternative example showing the pattern with multiple branches
export function setupMultipleBranches() {
  const expressApp = Express()
  const rootRouter = Express.Router()
  expressApp.use('/api', rootRouter)

  const app = TypedExpressApplication.withoutVersioning(
    rootRouter,
    bagOfRoutes,
    '/api'
  )

  const args = {
    prisma: {
      /* mock prisma client */
    },
  }

  // You can also use this pattern with multiple branches
  app
    .branch('/admin')
    .use(withAdminAuthentication)
    .use(withAdminPoolAndClientIds)
    .router((adminBranch) => {
      // Configure admin-specific routes
      CurrentUserRouterAdmin(args)(adminBranch)
      AccountRouterAdmin(args)(adminBranch)
    })

  app
    .branch('/public')
    .use((req, res, next) => {
      // Public middleware
      ;(req as any).isPublic = true
      next()
    })
    .router((publicBranch) => {
      // Configure public routes
      console.log('Configuring public routes')
    })

  return expressApp
}
