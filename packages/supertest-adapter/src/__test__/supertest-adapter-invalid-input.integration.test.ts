import { beforeEach, describe, expect, test } from 'vitest'
import {
  BagOfRoutes,
  Route,
  ValidationError,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { TypedExpressApplication } from '@t-rest/express-server'
import { z } from 'zod'
import Express, { NextFunction, Request, Response } from 'express'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { versionInjectorFrom } from '../utils/version-injector-from.js'
import { versionHeader } from '@t-rest/protocol'

const verbs = ['get', 'post', 'put', 'patch', 'delete'] as const
const methodsWithBody = ['post', 'put', 'patch'] as const

const versionHistory = VersionHistory(['2024-01-01'] as const)

const input = z.object({
  params: z.object({ itemId: z.string().regex(/^\d+$/) }),
  query: z.object({ page: z.string().regex(/^\d+$/) }),
})

const inputWithBody = input.extend({
  body: z.object({ name: z.string() }),
})

const unversionedRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/items/:itemId').validate(input).response<{ ok: true }>()
  )
  .addRoute(
    Route.post('/items/:itemId')
      .validate(inputWithBody)
      .response<{ ok: true }>()
  )
  .addRoute(
    Route.put('/items/:itemId').validate(inputWithBody).response<{ ok: true }>()
  )
  .addRoute(
    Route.patch('/items/:itemId')
      .validate(inputWithBody)
      .response<{ ok: true }>()
  )
  .addRoute(
    Route.delete('/items/:itemId').validate(input).response<{ ok: true }>()
  )
  .build()

const versionedRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    Route.version('2024-01-01')
      .get('/items/:itemId')
      .validate(input)
      .response<{ ok: true }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/items/:itemId')
      .validate(inputWithBody)
      .response<{ ok: true }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .put('/items/:itemId')
      .validate(inputWithBody)
      .response<{ ok: true }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .patch('/items/:itemId')
      .validate(inputWithBody)
      .response<{ ok: true }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .delete('/items/:itemId')
      .validate(input)
      .response<{ ok: true }>()
  )
  .build()

const handleValidationError = (
  error: unknown,
  _: Request,
  response: Response,
  next: NextFunction
) => {
  if (ValidationError.isValidationError(error)) {
    response.status(400).json({ message: 'invalid input' })
    return
  }

  next(error)
}

let receivedBodies: unknown[] = []

const makeExpressApp = () => {
  const expressApp = Express()
  expressApp.use(Express.json({ strict: false }))
  expressApp.use((request, _, next) => {
    receivedBodies.push(request.body)
    next()
  })

  return expressApp
}

const makeUnversioned = () => {
  const expressApp = makeExpressApp()
  const app = TypedExpressApplication.withoutVersioning(
    expressApp,
    unversionedRoutes
  )

  for (const verb of verbs) {
    app[verb]('/items/:itemId').handle((_, __, response) => {
      response.json({ ok: true })
    })
  }

  expressApp.use(handleValidationError)

  return SupertestAdapter.withoutVersioning(app)
}

const makeVersioned = () => {
  const expressApp = makeExpressApp()
  const app = TypedExpressApplication.withVersioning(
    expressApp,
    versionedRoutes,
    versionHistory,
    { extractVersion: (request) => request.header('x-api-version') }
  )

  for (const verb of verbs) {
    app[verb]('/items/:itemId')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json({ ok: true })
      })
  }

  expressApp.use(handleValidationError)

  return SupertestAdapter.withVersioning(
    app,
    versionInjectorFrom(versionHeader('x-api-version'))
  )
}

beforeEach(() => {
  receivedBodies = []
})

const params = { itemId: '1' }
const query = { page: '1' }
const body = { name: 'chair' }

describe.each(verbs)('%s without versioning', (verb) => {
  // the handlers of the verbs share their signature, only unioned they are not callable
  const call = (adapter = makeUnversioned()) =>
    adapter.invalid[verb] as typeof adapter.invalid.post

  test('rejects invalid params', async () => {
    await call()('/items/:itemId', {
      params: { itemId: 'abc' },
      query,
      body,
      expect: { status: 400 },
    })
  })

  test('rejects invalid query', async () => {
    await call()('/items/:itemId', {
      params,
      query: { page: 'abc' },
      body,
      expect: { status: 400 },
    })
  })

  test('valid input still passes', async () => {
    const response = await call()('/items/:itemId', {
      params,
      query,
      body,
      expect: { status: 200 },
    })

    expect(response.body).toEqual({ ok: true })
  })
})

describe.each(verbs)('%s with versioning', (verb) => {
  const call = (adapter = makeVersioned()) =>
    adapter.invalid[verb] as typeof adapter.invalid.post

  test('sends the version and rejects invalid input', async () => {
    await call()('/items/:itemId', '2024-01-01', {
      params,
      query: { page: 'abc' },
      body,
      expect: { status: 400 },
    })
  })

  test('valid input still passes', async () => {
    await call()('/items/:itemId', '2024-01-01', {
      params,
      query,
      body,
      expect: { status: 200 },
    })
  })
})

describe.each(methodsWithBody)('%s body', (verb) => {
  // strings are sent as they are and not as json, so express.json skips them
  test.each([
    ['object of the wrong shape', { name: 42 }, { name: 42 }],
    ['array', [1, 2], [1, 2]],
    ['string', 'chair', undefined],
    ['number', 42, 42],
    ['boolean', true, true],
    ['null', null, null],
    ['missing', undefined, undefined],
  ])('rejects a body that is a %s', async (_, invalidBody, received) => {
    const adapter = makeUnversioned()
    const call = adapter.invalid[verb] as typeof adapter.invalid.post

    await call('/items/:itemId', {
      params,
      query,
      body: invalidBody,
      expect: { status: 400 },
    })

    expect(receivedBodies).toEqual([received])
  })
})

test('input can be left out entirely', async () => {
  await makeUnversioned().invalid.post('/items/:itemId', {
    expect: { status: 400 },
  })
})

test.each([
  ['null params', { params: null, query }],
  ['non object params', { params: 42, query }],
  ['non object query', { params, query: 42 }],
])('sends %s', async (_, invalidInput) => {
  await makeUnversioned().invalid.get('/items/:itemId', {
    ...invalidInput,
    expect: { status: 400 },
  })
})
