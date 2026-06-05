import {
  BagOfRoutes,
  Route,
  versionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import { z } from 'zod'
import { TypeDefinition } from '../../../schema/type-schema.js'

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/coordinates')
      .validate(
        z.object({
          body: z.object({
            coordinates: z.tuple([z.number(), z.number(), z.string()]),
            insertionDateRange: z
              .tuple([ze.parseDate(), ze.parseDate()])
              .optional(),
          }),
        })
      )
      .response<{ ok: boolean }>()
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
            coordinates: {
              kind: 'tuple',
              elementTypes: [
                { kind: 'number' },
                { kind: 'number' },
                { kind: 'string' },
              ],
            },
            insertionDateRange: {
              kind: 'tuple',
              elementTypes: [{ kind: 'date' }, { kind: 'date' }],
            },
          },
          required: ['coordinates'],
        },
      },
      required: ['body'],
    } satisfies TypeDefinition,
    output: {
      kind: 'object',
      properties: {
        ok: { kind: 'boolean' },
      },
      required: ['ok'],
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/coordinates' },
  },
]
