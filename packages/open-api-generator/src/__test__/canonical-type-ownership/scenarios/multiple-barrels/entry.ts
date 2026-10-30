import { BagOfRoutes, Route, Versioning } from '@t-rest/core'
import type * as V2026_06_09 from './models/2026_06_09/index.js'

export * from './models/index.js'

export default BagOfRoutes.withVersioning(Versioning.DATE, ['2026-06-09'])
  .addRoute(
    Route.version('2026-06-09')
      .get('/multiple-barrels')
      .response<V2026_06_09.Admin.Order.Order>()
  )
  .build()
