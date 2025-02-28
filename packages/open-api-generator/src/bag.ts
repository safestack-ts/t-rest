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

const validateValidity = z.object({
  from: ze.iso8601DateString(),
  to: ze.iso8601DateString(),
})

const validateQuantitySelection = z.object({
  kind: z.literal('quantity'),
  value: z.number().int(),
})

const validateAnonymousPersonTypeSelection = z.object({
  kind: z.literal('anonymous'),
  quantity: z.number().int(),
  personType: z.string(),
})

const validatePersonalizedPersonTypeSelection = z.object({
  kind: z.literal('personalized'),
  personIds: z.array(ze.databaseId()),
  personType: z.string(),
})

const validatePersonTypeSelection = z.object({
  kind: z.literal('persontype'),
  // due to a nasty zod inference bug regarding union of array types which has not been fixed yet
  // https://github.com/colinhacks/zod/issues/2203
  // and a nasty typescript limitation on mapping over strict separated union array types, we have to move the strict xor check into a superRefine
  // https://github.com/microsoft/TypeScript/issues/33591
  values: z
    .array(
      z.union([
        validateAnonymousPersonTypeSelection,
        validatePersonalizedPersonTypeSelection,
      ])
    )
    .superRefine((values, ctx) => {
      const anonymous = values.filter(({ kind }) => kind === 'anonymous')
      const personalized = values.filter(({ kind }) => kind === 'personalized')
      if (anonymous.length > 0 && personalized.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Anonymous and personalized person types cannot be mixed.',
          path: [],
        })
      }
    }),
})

const validateAllocation = z.discriminatedUnion('kind', [
  validateQuantitySelection,
  validatePersonTypeSelection,
])

const validateFormState = z
  .object({
    validity: validateValidity.optional(),
    allocation: validateAllocation.optional(),
    attributes: z
      .record(z.string(), z.union([z.string(), z.null()]))
      .optional()
      .default({}),
  })
  .superRefine(({ attributes }, ctx) => {
    if ('age' in attributes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Age attribute selection must happen via personTypes, not attributes.',
        path: [],
      })
    }
  })

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
          query: z.object({
            formState: validateFormState,
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
