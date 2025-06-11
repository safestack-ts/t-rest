import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { TypeDefinition } from '../../../schema/type-schema'

type SubscriptionItem = {
  id: number
  name: string
}

type Subscription = {
  id: number
} & (
  | {
      type: 'bundle'
      subscriptionItems: SubscriptionItem[]
    }
  | {
      type: 'single'
      subscriptionItems: [SubscriptionItem]
    }
)

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/subscriptions').response<Subscription>()
  )
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {},
    } satisfies TypeDefinition,
    output: {
      kind: 'union',
      types: [
        {
          kind: 'object',
          properties: {
            id: { kind: 'number' },
            type: { kind: 'literal', value: 'bundle' },
            subscriptionItems: {
              kind: 'array',
              items: {
                kind: 'object',
                name: 'SubscriptionItem',
                properties: {
                  id: { kind: 'number' },
                  name: { kind: 'string' },
                },
                required: ['id', 'name'],
              },
            },
          },
          required: ['id', 'type', 'subscriptionItems'],
        },
        {
          kind: 'object',
          properties: {
            id: { kind: 'number' },
            type: { kind: 'literal', value: 'single' },
            subscriptionItems: {
              kind: 'tuple',
              elementTypes: [
                {
                  kind: 'ref',
                  name: 'SubscriptionItem',
                },
              ],
            },
          },
          required: ['id', 'type', 'subscriptionItems'],
        },
      ],
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/subscriptions' },
  },
]
