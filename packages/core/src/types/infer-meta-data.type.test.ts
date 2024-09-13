import { z } from 'zod'
import { ExtractRoutes } from './extract-route'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import { VersionHistory } from '../utils/version-history'
import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Route } from '../classes/core/route'
import { InferMetaData } from './infer-meta-data'
import { Versioning } from '../enums/versioning'

// unversioned routes
const unversionedBagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/users')
      .metaData({ description: 'Get all users' })
      .response<void>()
  )
  .addRoute(
    Route.post('/users')
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .metaData({ description: 'Create a user' })
      .response<void>()
  )
  .build()

type UnversionedRoutes = ExtractRoutes<typeof unversionedBagOfRoutes>

type UnversionedGetUsersRoute = Extract<
  UnversionedRoutes,
  { method: 'GET'; path: '/users' }
>
type UnversionedGetUsersRouteMetaData = InferMetaData<UnversionedGetUsersRoute>

type UnversionedPostUsersRoute = Extract<
  UnversionedRoutes,
  { method: 'POST'; path: '/users' }
>
type UnversionedPostUsersRouteMetaData =
  InferMetaData<UnversionedPostUsersRoute>

type _test_unversioned_routes =
  | AssertTrue<
      IsExact<UnversionedGetUsersRouteMetaData, { description: string }>
    >
  | AssertTrue<
      IsExact<UnversionedPostUsersRouteMetaData, { description: string }>
    >

// versioned routes
const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

const versionedBagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    Route.version('2024-01-01')
      .get('/users')
      .metaData({ description: 'Get all users' })
      .response<void>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/users')
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .metaData({ description: 'Create a user', tags: ['admin'] })
      .response<void>()
  )
  .build()

type VersionedRoutes = ExtractRoutes<typeof versionedBagOfRoutes>

type VersionedGetUsersRoute = Extract<
  VersionedRoutes,
  { method: 'GET'; path: '/users' }
>

type VersionedGetUsersRouteMetaData = InferMetaData<VersionedGetUsersRoute>

type VersionedPostUsersRoute = Extract<
  VersionedRoutes,
  { method: 'POST'; path: '/users' }
>

type VersionedPostUsersRouteMetaData = InferMetaData<VersionedPostUsersRoute>

type _test_versioned_routes =
  | AssertTrue<IsExact<VersionedGetUsersRouteMetaData, { description: string }>>
  | AssertTrue<
      IsExact<
        VersionedPostUsersRouteMetaData,
        { description: string; tags: string[] }
      >
    >
