import { expect, test } from 'vitest'
import { z } from 'zod'
import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { Route } from '../classes/core/route.js'
import { RouteDef } from '../classes/core/route-def.js'
import { Versioning } from '../enums/versioning.js'
import { combine } from '../utils/combine.js'
import { empty, json } from '../utils/response-descriptors.js'

const invalid = json(z.object({ issues: z.array(z.string()) }), {
  id: 'BadRequest',
})
const notFound = json<{ missing: string }>()

const list = Route.get('/invoices')
  .validate(z.object({ query: z.object({ page: z.string() }) }), {
    examples: { first: { value: { query: { page: '1' } } } },
  })
  .metaData({ public: true })
  .response<unknown>()
const single = Route.get('/invoices/:id').responses({
  200: json<unknown>(),
  400: notFound,
})
const bag = BagOfRoutes.withoutVersioning()
  .addRoute(list)
  .addRoute(single)
  .build()

test('routes declare the default responses, their own declarations win', () => {
  const withDefaults = bag.withDefaultResponses({ 400: invalid, 404: empty() })

  expect(withDefaults.routes.get(['GET', '/invoices', ''])?.responses).toEqual({
    200: json(),
    400: invalid,
    404: empty(),
  })
  expect(
    withDefaults.routes.get(['GET', '/invoices/:id', ''])?.responses
  ).toEqual({ 200: json(), 400: notFound, 404: empty() })
})

test('default responses keep everything else of a route', () => {
  const route = bag
    .withDefaultResponses({ 400: invalid })
    .routes.get(['GET', '/invoices', ''])

  expect(route).toBeInstanceOf(RouteDef)
  expect(route).toMatchObject({
    method: 'GET',
    path: '/invoices',
    validator: list.validator,
    metaData: { public: true },
    requestExamples: { first: { value: { query: { page: '1' } } } },
    bodyEncoding: 'json',
  })
})

test('default responses share the descriptor between routes', () => {
  const withDefaults = bag.withDefaultResponses({ 400: invalid, 404: empty() })

  expect(
    withDefaults.routes.get(['GET', '/invoices', ''])?.responses[400]
  ).toBe(invalid)
})

test('default responses leave the original bag and routes unchanged', () => {
  bag.withDefaultResponses({ 400: invalid })

  expect(bag.routes.get(['GET', '/invoices', ''])).toBe(list)
  expect(list.responses).toEqual({ 200: json() })
})

test('applying the same default responses twice changes nothing', () => {
  const once = bag.withDefaultResponses({ 400: invalid })
  const twice = once.withDefaultResponses({ 400: invalid })

  expect(Array.from(twice.routes.entries())).toEqual(
    Array.from(once.routes.entries())
  )
})

test('default responses keep the versioning of the bag', () => {
  const versioned = BagOfRoutes.withVersioning(Versioning.DATE, ['2024-01-01'])
    .addRoute(Route.version('2024-01-01').get('/').response<unknown>())
    .build()
    .withDefaultResponses({ 400: invalid })

  expect(versioned.versioning).toBe(Versioning.DATE)
  expect(versioned.versionHistory).toEqual(['2024-01-01'])
  expect(versioned.routes.get(['GET', '/', '2024-01-01'])?.responses[400]).toBe(
    invalid
  )
})

test('defaults applied to combined bags fill the routes of every bag', () => {
  const other = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/customers').response<unknown>())
    .build()
    .withDefaultResponses({ 404: empty() })

  const combined = combine(bag, other).withDefaultResponses({ 400: invalid })

  expect(combined.routes.get(['GET', '/customers', ''])?.responses).toEqual({
    200: json(),
    400: invalid,
    404: empty(),
  })
  expect(
    combined.routes.get(['GET', '/invoices/:id', ''])?.responses[400]
  ).toBe(notFound)
})
