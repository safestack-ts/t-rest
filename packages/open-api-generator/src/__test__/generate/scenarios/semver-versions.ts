import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'

export const versionHistory = VersionHistory([
  '1.0.0',
  '1.1.0',
  '2.0.0',
] as const)

type UserV1 = { id: number; name: string }
type UserV2 = { id: number; firstName: string; lastName: string }

export default BagOfRoutes.withVersioning(Versioning.SEMVER, versionHistory)
  .addRoute(Route.version('1.0.0').get('/users').response<UserV1[]>())
  .addRoute(Route.version('2.0.0').get('/users').response<UserV2[]>())
  .addRoute(
    Route.version('1.1.0')
      .get('/users/:userId')
      .metaData({ tags: 'users' })
      .response<UserV1>()
  )
  .build()
