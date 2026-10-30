import { BagOfRoutes, Route, Versioning } from '@t-rest/core'
import type * as V2025_02_18 from './models/2025_02_18/index.js'
import type * as V2026_06_09 from './models/2026_06_09/index.js'

export * from './models/index.js'

export default BagOfRoutes.withVersioning(Versioning.DATE, [
  '2025-02-18',
  '2026-06-09',
])
  .addRoute(
    Route.version('2025-02-18')
      .get('/orders')
      .response<V2025_02_18.Customer.Order.Order>()
  )
  .addRoute(
    Route.version('2026-06-09')
      .get('/checkouts')
      .response<V2026_06_09.Customer.Checkout.Checkout>()
  )
  .build()
