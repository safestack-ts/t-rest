import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from '../../ambiguous-type-detection/scenarios/esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

class Bags {
  // Comes first and defines the same route key, but is not exported.
  static admin() {
    return BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
      .addRoute(
        Route.version('2024-01-01')
          .get('/accounts/:accountId')
          .validate(z.object({}))
          .response<APIResponse<V2026_06_09.Admin.Checkout.Checkout>>()
      )
      .build()
  }

  static customer() {
    return BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
      .addRoute(
        Route.version('2024-01-01')
          .get('/accounts/:accountId')
          .validate(z.object({}))
          .response<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>()
      )
      .build()
  }
}

export const adminBagOfRoutes = Bags.admin()

export default Bags.customer()
