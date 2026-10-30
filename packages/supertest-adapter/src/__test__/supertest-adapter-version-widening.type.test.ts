import { AssertTrue, IsExact } from 'conditional-type-checks'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { TypedExpressApplication } from '@t-rest/express-server'
import Express from 'express'
import { z } from 'zod'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { SupertestVersionInjector } from '../classes/version-injector.js'
import { SupertestConfig } from '../types/supertest-config.js'
import { SupertestResponse } from '../types/supertest-response.js'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
  '2024-04-01',
] as const)

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/items')
      .validate(z.object({ query: z.object({ page: z.string() }) }))
      .response<{ v: 1 }>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .get('/items')
      .validate(z.object({ query: z.object({ cursor: z.string() }) }))
      .response<{ v: 3 }>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .post('/orders')
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .response<{ ordered: true }>()
  )
  .build()

const app = TypedExpressApplication.withVersioning(
  Express(),
  bagOfRoutes,
  versionHistory,
  { extractVersion: () => undefined }
)

const adapter = SupertestAdapter.withVersioning(
  app,
  new (class extends SupertestVersionInjector {})()
)

type Handler = typeof adapter.get

// exactly declared versions type as before
type _exactParameters = AssertTrue<IsExact<Parameters<Handler>[0], '/items'>>

export const test = async () => {
  const exactFirst = await adapter.get('/items', '2024-01-01', {
    query: { page: '1' },
  })
  type _exactFirst = AssertTrue<
    IsExact<typeof exactFirst, SupertestResponse<{ v: 1 }>>
  >

  const exactLatest = await adapter.get('/items', '2024-03-01', {
    query: { cursor: 'a' },
  })
  type _exactLatest = AssertTrue<
    IsExact<typeof exactLatest, SupertestResponse<{ v: 3 }>>
  >

  // versions in between resolve to the newest older route
  const inherited = await adapter.get('/items', '2024-02-01', {
    query: { page: '1' },
  })
  type _inherited = AssertTrue<
    IsExact<typeof inherited, SupertestResponse<{ v: 1 }>>
  >

  // versions newer than the newest route resolve to it
  const newer = await adapter.get('/items', '2024-04-01', {
    query: { cursor: 'a' },
  })
  type _newer = AssertTrue<IsExact<typeof newer, SupertestResponse<{ v: 3 }>>>

  // the input is the one of the resolved route
  await adapter.get('/items', '2024-04-01', {
    // @ts-expect-error the route of 2024-03-01 takes a cursor
    query: { page: '1' },
  })

  // older than every declared version of the route
  // @ts-expect-error the server cannot resolve a route for it
  await adapter.post('/orders', '2024-01-01', { body: { name: 'chair' } })

  // @ts-expect-error not a version of the history
  await adapter.get('/items', '2025-01-01', { query: { page: '1' } })

  const order = await adapter.post('/orders', '2024-04-01', {
    body: { name: 'chair' },
  })
  type _order = AssertTrue<
    IsExact<typeof order, SupertestResponse<{ ordered: true }>>
  >
}

// the whole call signature of an exact declared version is unchanged
type _context = AssertTrue<
  IsExact<
    Parameters<typeof adapter.get<'/items', '2024-01-01'>>[2],
    SupertestConfig & { query: { page: string } }
  >
>
type _returnType = AssertTrue<
  IsExact<
    ReturnType<typeof adapter.get<'/items', '2024-03-01'>>,
    Promise<SupertestResponse<{ v: 3 }>>
  >
>

// a union of versions yields the routes of all its members
export const unionTest = async (
  mixed: '2024-01-01' | '2024-04-01',
  inherited: '2024-02-01' | '2024-04-01'
) => {
  const mixedResponse = await adapter.get('/items', mixed, {} as any)
  type _mixed = AssertTrue<
    IsExact<typeof mixedResponse, SupertestResponse<{ v: 1 } | { v: 3 }>>
  >

  const inheritedResponse = await adapter.get('/items', inherited, {} as any)
  type _inherited = AssertTrue<
    IsExact<typeof inheritedResponse, SupertestResponse<{ v: 1 } | { v: 3 }>>
  >
}

const renamedBag = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/users/:id')
      .validate(
        z.object({
          params: z.object({ id: z.string() }),
          query: z.object({ page: z.string() }),
        })
      )
      .response<{ v: 1 }>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .get('/users/:userId')
      .validate(
        z.object({
          params: z.object({ userId: z.string() }),
          query: z.object({ cursor: z.string() }),
        })
      )
      .response<{ v: 3 }>()
  )
  .build()

const renamedAdapter = SupertestAdapter.withVersioning(
  TypedExpressApplication.withVersioning(
    Express(),
    renamedBag,
    versionHistory,
    { extractVersion: () => undefined }
  ),
  new (class extends SupertestVersionInjector {})()
)

// the server groups templates by shape, so a renamed template supersedes the old one
export const renamedTest = async () => {
  const old = await renamedAdapter.get('/users/:id', '2024-02-01', {
    params: { id: '1' },
    query: { page: '1' },
  })
  type _old = AssertTrue<IsExact<typeof old, SupertestResponse<{ v: 1 }>>>

  const renamed = await renamedAdapter.get('/users/:userId', '2024-04-01', {
    params: { userId: '1' },
    query: { cursor: 'a' },
  })
  type _renamed = AssertTrue<
    IsExact<typeof renamed, SupertestResponse<{ v: 3 }>>
  >

  await renamedAdapter.get(
    '/users/:id',
    // @ts-expect-error the server executes the route of /users/:userId
    '2024-04-01',
    { params: { id: '1' }, query: { page: '1' } }
  )
}

const suffixBag = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/files/:id.json')
      .validate(z.object({ params: z.object({ id: z.string() }) }))
      .response<{ format: 'json' }>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .get('/files/:id.xml')
      .validate(z.object({ params: z.object({ id: z.string() }) }))
      .response<{ format: 'xml' }>()
  )
  .build()

const suffixAdapter = SupertestAdapter.withVersioning(
  TypedExpressApplication.withVersioning(Express(), suffixBag, versionHistory, {
    extractVersion: () => undefined,
  }),
  new (class extends SupertestVersionInjector {})()
)

// literal suffixes after a path param keep templates apart
export const suffixTest = async () => {
  const json = await suffixAdapter.get('/files/:id.json', '2024-04-01', {
    params: { id: '1' },
  })
  type _json = AssertTrue<
    IsExact<typeof json, SupertestResponse<{ format: 'json' }>>
  >
}
