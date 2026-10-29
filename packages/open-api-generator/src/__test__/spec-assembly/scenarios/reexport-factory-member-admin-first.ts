import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from '../../ambiguous-type-detection/scenarios/esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

// The container is created by a factory, but its members do not depend on the
// factory arguments, so only the selected customer member may determine the
// naming of the exported bag.
function createBags() {
  const bags = {
    admin: BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
      .addRoute(
        Route.version('2024-01-01')
          .get('/accounts/:accountId')
          .validate(z.object({}))
          .response<APIResponse<V2026_06_09.Admin.Checkout.Checkout>>()
      )
      .build(),
    customer: BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
      .addRoute(
        Route.version('2024-01-01')
          .get('/accounts/:accountId')
          .validate(z.object({}))
          .response<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>()
      )
      .build(),
  }
  return bags
}

export default createBags().customer
