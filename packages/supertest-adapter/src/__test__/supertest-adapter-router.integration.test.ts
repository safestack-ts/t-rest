import { expect, test } from 'vitest'
import {
  BagOfRoutes,
  Route,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import {
  DateVersionExtractor,
  ExpressRequest,
  TypedExpressApplication,
} from '@t-rest/express-server'
import { z } from 'zod'
import Express from 'express'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { SupertestTargetError } from '../classes/supertest-target-error.js'
import { SupertestVersionInjector } from '../classes/version-injector.js'

type Item = { id: number; name: string }

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/api/items/:itemId')
      .validate(z.object({ params: z.object({ itemId: ze.parseInteger() }) }))
      .response<Item>()
  )
  .addRoute(
    Route.post('/api/items')
      .validate(z.object({ body: z.strictObject({ name: z.string() }) }))
      .response<Item>()
  )
  .build()

// the typed application is built on a router mounted on a path, while the
// body parser is registered on the root application
const makeRouterApplication = () => {
  const expressApp = Express()
  const itemsRouter = Express.Router()
  expressApp.use(Express.json())
  expressApp.use('/api/items', itemsRouter)

  const app = TypedExpressApplication.withoutVersioning(
    itemsRouter,
    bagOfRoutes,
    '/api/items'
  )
  app.get('/:itemId').handle((_, { params }, response) => {
    response.json({ id: params.itemId, name: 'chair' })
  })
  app.post('/').handle((_, { body }, response) => {
    response.status(201).json({ id: 1, name: body.name })
  })

  return { expressApp, app }
}

test('a typed application built on a router without the root application is rejected', () => {
  const { app } = makeRouterApplication()

  expect(() => SupertestAdapter.withoutVersioning(app)).toThrow(
    /built on an express router.*`expressApp`/
  )
  expect(() => SupertestAdapter.withoutVersioning(app)).toThrow(
    SupertestTargetError
  )
})

test('requests are sent to the root application of a router', async () => {
  const { expressApp, app } = makeRouterApplication()
  const adapter = SupertestAdapter.withoutVersioning(app, { expressApp })

  const { body } = await adapter.get('/api/items/:itemId', {
    params: { itemId: 7 },
    expect: { status: 200 },
  })
  expect(body).toEqual({ id: 7, name: 'chair' })

  // the body parser of the root application is applied
  const created = await adapter.post('/api/items', {
    body: { name: 'table' },
    expect: { status: 201 },
  })
  expect(created.body).toEqual({ id: 1, name: 'table' })
})

test('routes the router does not handle respond with not found', async () => {
  const { expressApp, app } = makeRouterApplication()
  const adapter = SupertestAdapter.withoutVersioning(app, { expressApp })

  const response = await adapter.get(
    '/api/unknown/:itemId' as '/api/items/:itemId',
    { params: { itemId: 1 } }
  )
  expect(response.status).toBe(404)
})

test('an explicitly passed router is rejected', () => {
  const { app } = makeRouterApplication()

  expect(() =>
    SupertestAdapter.withoutVersioning(app, {
      // @ts-expect-error a router is not a valid request target
      expressApp: Express.Router(),
    })
  ).toThrow(/built on an express router/)
})

test('a versioned typed application built on a router uses the root application', async () => {
  const versionHistory = VersionHistory(['2024-01-01'] as const)
  const versionedBagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/api/items')
        .response<{ version: string }>()
    )
    .build()

  class HeaderVersionExtractor implements DateVersionExtractor {
    extractVersion(request: ExpressRequest) {
      return request.header('x-api-version')
    }
    parseDate(version: string) {
      return new Date(version)
    }
  }
  class HeaderVersionInjector extends SupertestVersionInjector {
    modifyHeaders(
      headers: Record<string, string | number | boolean>,
      version: string
    ) {
      return { ...headers, 'x-api-version': version }
    }
  }

  const expressApp = Express()
  const itemsRouter = Express.Router()
  expressApp.use('/api/items', itemsRouter)
  const app = TypedExpressApplication.withVersioning(
    itemsRouter,
    versionedBagOfRoutes,
    versionHistory,
    new HeaderVersionExtractor(),
    '/api/items'
  )
  app
    .get('/')
    .version('2024-01-01')
    .handle((request, _, response) => {
      response.json({ version: request.version.resolved })
    })

  expect(() =>
    SupertestAdapter.withVersioning(app, new HeaderVersionInjector())
  ).toThrow(/built on an express router/)

  const adapter = SupertestAdapter.withVersioning(
    app,
    new HeaderVersionInjector(),
    { expressApp }
  )
  const { body } = await adapter.get('/api/items', '2024-01-01', {
    expect: { status: 200 },
  })
  expect(body).toEqual({ version: '2024-01-01' })
})
