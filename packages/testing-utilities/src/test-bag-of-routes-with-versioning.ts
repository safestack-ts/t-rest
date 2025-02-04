import {
  BagOfRoutes,
  Route,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
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
      Route.version('2024-01-01')
        .get('/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<ResponseWithVersion<User>>()
    )
    .addRoute(
      Route.version('2024-02-01')
        .get('/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.uuid() }) }))
        .response<ResponseWithVersion<UserWithTags>>()
    )
    .addRoute(
      Route.version('2024-02-01')
        .get('/complexRoute')
        .validate(
          z.object({
            body: z.object({
              validAt: ze.parseDate(),
              productDefinitionIds: ze.jsonObject(
                z.array(ze.parseInteger()).nonempty()
              ),
              from: ze.parseDate(),
              to: ze.parseDate(),
            }),
          })
        )
        .response<ResponseWithVersion<UserWithTags>>()
    )
    .build()
}
