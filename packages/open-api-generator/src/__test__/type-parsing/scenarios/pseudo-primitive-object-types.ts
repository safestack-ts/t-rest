import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { TypeDefinition } from '../../../schema/type-schema.js'

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/pseudo-primitive-types')
      .validate(
        z.object({
          body: z.object({
            anyMap: z.record(z.string(), z.any()),
            unknownMap: z.record(z.string(), z.unknown()),
          }),
        })
      )
      .response<undefined>()
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
            anyMap: {
              kind: 'record',
              value: {
                kind: 'object',
                properties: {},
              },
            },
            unknownMap: {
              kind: 'record',
              value: {
                kind: 'object',
                properties: {},
              },
            },
          },
          required: ['anyMap', 'unknownMap'],
        },
      },
      required: ['body'],
    } satisfies TypeDefinition,
    output: {
      kind: 'object',
      properties: {},
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/pseudo-primitive-types' },
  },
]
