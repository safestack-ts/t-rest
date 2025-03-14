import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/hello')
      .validate(
        z.object({
          name: z.string(),
          age: z.number(),
        })
      )
      .response<string>()
  )
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {
        name: { kind: 'string' },
        age: { kind: 'number' },
      },
      required: ['name', 'age'],
    },
    output: { kind: 'string' },
    routeMeta: { originalPath: '/hello' },
  },
]
