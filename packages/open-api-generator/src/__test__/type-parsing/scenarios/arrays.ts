import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { TypeDefinition } from '../../../schema/type-schema'

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/hello').validate(z.object({})).response<{
      type: Array<number>
      empty: []
      //tuple: [number, string] //@TODO add tuple support
      //tuple2: [string, ...string[]],
    }>()
  )
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {},
    } satisfies TypeDefinition,
    output: {
      kind: 'object',
      properties: {
        type: { kind: 'array', items: { kind: 'number' } },
        empty: { kind: 'array', maxItems: 0 },
        /*tuple: {
          kind: 'tuple',
          elementTypes: [{ kind: 'number' }, { kind: 'string' }],
        },*/
        //tuple2: { kind: 'array', items: [{ kind: 'string' }, { kind: 'string' }] },
      },
      required: ['type', 'empty'],
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/hello' },
  },
]
