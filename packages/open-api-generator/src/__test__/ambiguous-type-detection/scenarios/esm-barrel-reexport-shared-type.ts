import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from './esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/customer/checkouts/:checkoutId')
      .validate(z.object({}))
      .response<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/admin/checkouts/:checkoutId')
      .validate(z.object({}))
      .response<APIResponse<V2026_06_09.Admin.Checkout.Checkout>>()
  )
  .build()

export default bagOfRoutes
