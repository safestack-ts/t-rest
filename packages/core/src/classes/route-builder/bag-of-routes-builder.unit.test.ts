import { Versioning } from '../../enums/versioning.js'
import { BagOfRoutes } from '../core/bag-of-routes.js'
import { Route } from '../core/route.js'

const getUsers = Route.get('/users').response<unknown>()
const getPosts = Route.get('/posts').response<unknown>()

const getUsersV1 = Route.version('2024-01-01').get('/users').response<unknown>()
const getPostsV1 = Route.version('2024-01-01').get('/posts').response<unknown>()

describe('BagOfRoutesBuilderWithoutVersioning', () => {
  test('adding a route after build does not change the built bag', () => {
    const builder = BagOfRoutes.withoutVersioning().addRoute(getUsers)
    const bag = builder.build()

    builder.addRoute(getPosts)

    expect(bag.routes.size).toBe(1)
    expect(bag.routes.has(['GET', '/posts', ''])).toBe(false)
  })

  test('bags derived from a shared base builder are independent', () => {
    const base = BagOfRoutes.withoutVersioning().addRoute(getUsers)

    const bagA = base.build()
    const bagB = base.addRoute(getPosts).build()

    expect(bagA.routes.size).toBe(1)
    expect(bagB.routes.size).toBe(2)
    expect(bagB.routes.get(['GET', '/users', ''])).toBe(getUsers)
    expect(bagB.routes.get(['GET', '/posts', ''])).toBe(getPosts)
    expect(base.build().routes.size).toBe(1)
  })
})

describe('BagOfRoutesBuilderWithVersioning', () => {
  const versionHistory = ['2024-01-01']

  test('adding a route after build does not change the built bag', () => {
    const builder = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    ).addRoute(getUsersV1)
    const bag = builder.build()

    builder.addRoute(getPostsV1)

    expect(bag.routes.size).toBe(1)
    expect(bag.routes.has(['GET', '/posts', '2024-01-01'])).toBe(false)
  })

  test('bags derived from a shared base builder are independent', () => {
    const base = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    ).addRoute(getUsersV1)

    const bagA = base.build()
    const bagB = base.addRoute(getPostsV1).build()

    expect(bagA.routes.size).toBe(1)
    expect(bagB.routes.size).toBe(2)
    expect(bagB.routes.get(['GET', '/users', '2024-01-01'])).toBe(getUsersV1)
    expect(bagB.routes.get(['GET', '/posts', '2024-01-01'])).toBe(getPostsV1)
    expect(bagB.versioning).toBe(Versioning.DATE)
    expect(bagB.versionHistory).toBe(versionHistory)
  })
})
