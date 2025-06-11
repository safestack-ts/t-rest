import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { TypeDefinition } from '../../../schema/type-schema'

type Response = {
  values: string[] | number[]
}

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(Route.version('2024-01-01').get('/some-route').response<Response>())
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {},
    } satisfies TypeDefinition,
    output: {
      kind: 'object',
      name: 'Response',
      properties: {
        values: {
          kind: 'union',
          types: [
            {
              kind: 'array',
              items: {
                kind: 'string',
              },
            },
            {
              kind: 'array',
              items: {
                kind: 'number',
              },
            },
          ],
        },
      },
      required: ['values'],
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/some-route' },
  },
]
