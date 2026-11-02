import { AssertTrue, IsExact } from 'conditional-type-checks'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { TypedExpressApplication } from '@t-rest/express-server'
import Express from 'express'
import { z } from 'zod'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { SupertestVersionInjector } from '../classes/version-injector.js'
import { SupertestResponse } from '../types/supertest-response.js'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

const input = z.object({
  params: z.object({ userId: z.string() }),
  query: z.object({ page: z.string() }),
  body: z.object({ email: z.string() }),
})

const versionedApp = TypedExpressApplication.withVersioning(
  Express(),
  BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
    .addRoute(
      Route.version('2024-01-01')
        .post('/users/:userId')
        .validate(input)
        .response<{ v: 1 }>()
    )
    .addRoute(
      Route.version('2024-03-01')
        .post('/users/:userId')
        .validate(input)
        .response<{ v: 3 }>()
    )
    .build(),
  versionHistory,
  { extractVersion: () => undefined }
)

const versioned = SupertestAdapter.withVersioning(
  versionedApp,
  new (class extends SupertestVersionInjector {})()
)

const unversioned = SupertestAdapter.withoutVersioning(
  TypedExpressApplication.withoutVersioning(
    Express(),
    BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.post('/users/:userId').validate(input).response<{ v: 1 }>()
      )
      .addRoute(
        Route.get('/users/:userId')
          .validate(z.object({ params: input.shape.params }))
          .response<{ v: 2 }>()
      )
      .build()
  )
)

export const test = async () => {
  const declared = await versioned.invalid.post(
    '/users/:userId',
    '2024-03-01',
    {
      params: 42,
      query: ['page'],
      body: { email: 42 },
      expect: { status: 400 },
    }
  )
  type _declared = AssertTrue<
    IsExact<typeof declared, SupertestResponse<{ v: 3 }>>
  >

  // a version between two declared versions resolves down like a valid request
  const resolved = await versioned.invalid.post(
    '/users/:userId',
    '2024-02-01',
    {}
  )
  type _resolved = AssertTrue<
    IsExact<typeof resolved, SupertestResponse<{ v: 1 }>>
  >

  const post = await unversioned.invalid.post('/users/:userId', {
    params: null,
    body: 'email',
  })
  type _post = AssertTrue<IsExact<typeof post, SupertestResponse<{ v: 1 }>>>

  const get = await unversioned.invalid.get('/users/:userId', { query: 42 })
  type _get = AssertTrue<IsExact<typeof get, SupertestResponse<{ v: 2 }>>>

  // @ts-expect-error unknown path
  await versioned.invalid.post('/unknown', '2024-01-01', {})

  // @ts-expect-error version the route cannot be called with
  await versioned.invalid.post('/users/:userId', '2023-01-01', {})

  // @ts-expect-error the path has no route of this method
  await unversioned.invalid.put('/users/:userId', {})

  // @ts-expect-error a typo in the input is still rejected
  await unversioned.invalid.post('/users/:userId', { bdy: {} })

  // @ts-expect-error the regular handlers keep checking the input
  await unversioned.post('/users/:userId', { body: { email: 42 } })

  await versioned.post('/users/:userId', '2024-01-01', {
    params: { userId: '1' },
    query: { page: '1' },
    // @ts-expect-error the regular handlers keep checking the input
    body: { email: 42 },
  })
}
