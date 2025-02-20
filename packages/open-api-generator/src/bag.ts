import {
  BagOfRoutes,
  Route,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import {
  ResponseWithVersion,
  User,
  UserWithTags,
} from '@t-rest/testing-utilities'
import { z } from 'zod'
import { RouteMeta } from './schema/route-meta'
import dedent from 'dedent'

export const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

type Identify<T> = T
type UserWithSubUsers = User & {
  subUsers: UserWithSubUsers[]
  credit: Identify<number>
  photo: Buffer
}

export const bagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    Route.version('2024-01-01')
      .delete('/api/checkout/:checkoutId/discounts/:discountId')
      .validate(
        z.object({
          params: z.strictObject({
            checkoutId: z.string().uuid(),
            discountId: ze.parseDatabaseId(),
          }),
        })
      )
      .metaData(
        RouteMeta({
          description: 'Delete a discount code from a checkout',
          tags: ['checkout', 'discounts'],
        })
      )
      .response<{ message: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/users/:userId')
      .validate(
        z.object({ params: z.object({ userId: ze.parseDatabaseId() }) })
      )
      .metaData(
        RouteMeta({
          summary: 'Get user by id',
          description:
            'Get user by id if the user exists and is part of the requested client specified in the pratiq-client-id http header.',
          tags: ['users'],
          operationId: 'getUserById',
        })
      )
      .response<ResponseWithVersion<UserWithSubUsers>>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .get('/users/:userId')
      .validate(z.object({ params: z.object({ userId: ze.uuid() }) }))
      .metaData(
        RouteMeta({
          summary: 'Get user by id',
          description: dedent`
            Get user by id if the user exists and is part of the requested client specified in the pratiq-client-id http header.
            
            In addition, this new revision of the route also includes the tags of the user in the response.
            `,
          tags: ['users'],
          operationId: 'getUserById',
        })
      )
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
            ignoreStale: z.boolean().optional(),
          }),
        })
      )
      .response<ResponseWithVersion<UserWithTags>>()
  )
  .build()

export default bagOfRoutes
