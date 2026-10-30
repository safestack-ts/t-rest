import { BagOfRoutes, Route, Versioning } from '@t-rest/core'
import type * as V2026_06_09 from './models/2026_06_09/index.js'

export * from './models/index.js'

export default BagOfRoutes.withVersioning(Versioning.DATE, ['2026-06-09'])
  .addRoute(
    Route.version('2026-06-09')
      .get('/missing-owner')
      .response<V2026_06_09.Customer.Order.Order>()
  )
  .addRoute(
    Route.version('2026-06-09')
      .get('/second-missing-owner')
      .response<V2026_06_09.Customer.Checkout.Checkout>()
  )
  .build()
