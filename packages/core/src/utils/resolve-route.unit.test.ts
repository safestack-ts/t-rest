import { expect, test } from 'vitest'
import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { Route } from '../classes/core/route.js'
import { Versioning } from '../enums/versioning.js'
import { createRouteResolver } from './resolve-route.js'

const history = ['2024-01-01', '2024-02-01', '2024-03-01']

const v1 = Route.version('2024-01-01').get('/users').response<string>()
const v3 = Route.version('2024-03-01').get('/users').response<number>()
const other = Route.version('2024-02-01').get('/posts').response<string>()

const bag = BagOfRoutes.withVersioning(Versioning.DATE, history)
  .addRoute(v1)
  .addRoute(v3)
  .addRoute(other)
  .build()

test('resolves the declared route of the version', () => {
  const resolve = createRouteResolver(bag.routes, bag.versionHistory)

  expect(resolve('GET', '/users', '2024-01-01')).toBe(v1)
  expect(resolve('GET', '/users', '2024-03-01')).toBe(v3)
})

test('resolves the newest route of an older version', () => {
  const resolve = createRouteResolver(bag.routes, bag.versionHistory)

  expect(resolve('GET', '/users', '2024-02-01')).toBe(v1)
  expect(resolve('GET', '/posts', '2024-03-01')).toBe(other)
})

test('resolves versions outside of the history by date', () => {
  const withoutDates = createRouteResolver(bag.routes, bag.versionHistory)
  const withDates = createRouteResolver(
    bag.routes,
    bag.versionHistory,
    (version) => new Date(version)
  )

  expect(withoutDates('GET', '/users', '2024-02-15')).toBeUndefined()
  expect(withDates('GET', '/users', '2024-02-15')).toBe(v1)
})

test('returns undefined for unknown routes and older versions', () => {
  const resolve = createRouteResolver(bag.routes, bag.versionHistory)

  expect(resolve('GET', '/unknown', '2024-03-01')).toBeUndefined()
  expect(resolve('GET', '/posts', '2024-01-01')).toBeUndefined()
})

test('resolves unversioned routes', () => {
  const route = Route.get('/users').response<string>()
  const unversioned = BagOfRoutes.withoutVersioning().addRoute(route).build()
  const resolve = createRouteResolver(unversioned.routes, [])

  expect(resolve('GET', '/users', '')).toBe(route)
})
