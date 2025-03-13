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
  subUsers: (User | UserWithSubUsers)[]
  credit: Identify<number>
  photo: Buffer
}

interface CreateBasketChildEntryPayload {
  productDefinitionId: number
  slotId: number | null
  children?: CreateBasketChildEntryPayload[]
}

const validateCreateBasketChildEntryPayload: z.ZodSchema<CreateBasketChildEntryPayload> =
  z.strictObject({
    productDefinitionId: z.number().int().min(1),
    slotId: z.number().int().min(1).nullable(),
    children: z
      .array(z.lazy(() => validateCreateBasketChildEntryPayload))
      .optional(),
  })

const validateCreateBasketOriginatedEntryPayload = z.strictObject({
  productDefinitionId: z.number().int().min(1),
  slotId: z.number().int().min(1).nullable(),
})

export const bagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    Route.version('2024-01-01')
      .post('/api/checkout/:checkoutId/discounts/:discountId')
      .validate(
        z.object({
          body: z.strictObject({
            entries: z
              .array(
                z.strictObject({
                  productDefinitionId: z.number().int().min(1),
                  slotId: z.number().int().min(1).nullable(),
                  children: z
                    .array(validateCreateBasketChildEntryPayload)
                    .optional(),
                  originatedEntries: z
                    .array(validateCreateBasketOriginatedEntryPayload)
                    .optional(),
                })
              )
              .optional(),
          }),
        })
      )
      .metaData(
        RouteMeta({
          description: 'Delete a discount code from a checkout',
          tags: ['checkout', 'discounts'],
        })
      )
      .response<Omit<User, 'id'> & { message: string }>()
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
      .get('/users/:userIdentifier')
      .validate(z.object({ params: z.object({ userIdentifier: ze.uuid() }) }))
      .metaData(
        RouteMeta({
          summary: 'Get user by identifier',
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

type MyBag = typeof bagOfRoutes
type MyRoute = MyBag extends BagOfRoutes<infer TRoutes, any, any>
  ? Extract<
      TRoutes,
      { path: '/api/checkout/:checkoutId/discounts/:discountId' }
    >
  : never

type _A = MyRoute['~validatorOutputType']
