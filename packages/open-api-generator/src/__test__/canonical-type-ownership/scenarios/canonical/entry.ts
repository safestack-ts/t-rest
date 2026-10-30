import { BagOfRoutes, Route, Versioning } from '@t-rest/core'
import type * as V2024_01_01 from './models/2024_01_01/index.js'
import type * as V2026_06_09 from './models/2026_06_09/index.js'

export * from './models/index.js'

export default BagOfRoutes.withVersioning(Versioning.DATE, ['2026-06-09'])
  .addRoute(
    Route.version('2026-06-09')
      .get('/canonical-ownership')
      .response<V2026_06_09.Customer.Order.Order>()
  )
  .addRoute(
    Route.version('2026-06-09')
      .get('/discount-cards')
      .response<V2026_06_09.Customer.Discounting.DiscountCard[]>()
  )
  .addRoute(
    Route.version('2026-06-09')
      .get('/historical-basket-discount-cards')
      .response<V2024_01_01.Customer.Basket.BasketDiscountCard[]>()
  )
  .build()
