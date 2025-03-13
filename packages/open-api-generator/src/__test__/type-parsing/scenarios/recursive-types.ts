import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'
import { TypeDefinition } from '../../../schema/type-schema'

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

type UserWithSubUsers = User & {
  subUsers: UserWithSubUsers[]
}

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/test')
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
      .response<UserWithSubUsers>()
  )
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {
        body: {
          kind: 'object',
          properties: {
            entries: {
              kind: 'array',
              items: {
                kind: 'object',
                properties: {
                  productDefinitionId: {
                    kind: 'number',
                  },
                  slotId: {
                    kind: 'number',
                  },
                  children: {
                    kind: 'array',
                    items: {
                      kind: 'object',
                      name: 'CreateBasketChildEntryPayload',
                      properties: {
                        productDefinitionId: {
                          kind: 'number',
                        },
                        slotId: {
                          kind: 'number',
                        },
                        children: {
                          kind: 'array',
                          items: {
                            kind: 'ref',
                            name: 'CreateBasketChildEntryPayload',
                          },
                        },
                      },
                      required: ['productDefinitionId', 'slotId'],
                    },
                  },
                  originatedEntries: {
                    kind: 'array',
                    items: {
                      kind: 'object',
                      properties: {
                        productDefinitionId: {
                          kind: 'number',
                        },
                        slotId: {
                          kind: 'number',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } satisfies TypeDefinition,
    output: {
      kind: 'object',
      name: 'UserWithSubUsers',
      properties: {
        id: {
          kind: 'number',
        },
        email: {
          kind: 'string',
        },

        subUsers: {
          kind: 'array',
          items: {
            kind: 'ref',
            name: 'UserWithSubUsers',
          },
        },
      },
      required: ['id', 'email', 'subUsers'],
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/test' },
  },
]
