import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/hello')
      .validate(
        z.object({
          body: z.object({
            name: z.string(),
            age: z.number().nullable(),
            deletedAt: z.null(),
          }),
        })
      )
      .response<{ name: string; age: number | null; deletedAt: null }>()
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
            name: { kind: 'string' },
            age: {
              kind: 'number',
              nullable: true,
            },
            deletedAt: {
              kind: 'null',
            },
          },
          required: ['name', 'age', 'deletedAt'],
        },
      },
      required: ['body'],
    },
    output: {
      kind: 'object',
      properties: {
        name: { kind: 'string' },
        age: { kind: 'number', nullable: true },
        deletedAt: { kind: 'null' },
      },
      required: ['name', 'age', 'deletedAt'],
    },
    routeMeta: { originalPath: '/hello' },
  },
]
