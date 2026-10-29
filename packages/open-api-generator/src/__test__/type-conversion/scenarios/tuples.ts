import { BagOfRoutes, Route } from '@t-rest/core'

type Item = { id: string }
type Other = { name: string }

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/tuples').response<{
      pair: [Item, number]
      withArray: [Other, number[]]
      same: [string, string]
      overlapping: [number, 1]
    }>()
  )
  .build()
