import {
  BagOfRoutes,
  Route,
  VersionHistory,
  Versioning,
  ze,
} from '@typed-rest/core'
import { ResponseWithVersion } from './response-with-version'
import { User, UserWithTags } from './test-entity-types'
import { z } from 'zod'

export namespace TestBagOfRoutesWithVersioning {
  export const versionHistory = VersionHistory([
    '2024-01-01',
    '2024-02-01',
    '2024-03-01',
  ] as const)

  export const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      new Route()
        .version('2024-01-01')
        .get('/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<ResponseWithVersion<User>>()
    )
    .addRoute(
      new Route()
        .version('2024-02-01')
        .get('/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.uuid() }) }))
        .response<ResponseWithVersion<UserWithTags>>()
    )
    .build()
}
