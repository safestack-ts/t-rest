import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'

type Coordinate = { lat: number; lng: number }

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/tuple-elements')
      .validate(
        z.object({
          body: z.object({
            range: z.tuple([z.number(), z.number().optional()]),
            path: z.tuple([z.string()], z.number()),
          }),
        })
      )
      .response<{
        optional: [string, number?]
        rest: [Coordinate, ...Coordinate[]]
        leadingRest: [...string[], number]
        named: [from: Date, to: Date]
        readonlyPair: readonly [string, boolean]
      }>()
  )
  .build()
