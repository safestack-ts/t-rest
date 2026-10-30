import {
  BagOfRoutes,
  json,
  Route,
  versionHistory,
  Versioning,
} from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from '../../ambiguous-type-detection/scenarios/esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/checkouts/:checkoutId')
      .validate(z.object({}))
      .responses({
        200: json<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>(),
      })
  )
  .build()

// A second bag in the same program defines the same route key for another
// audience. It must not influence the naming of the exported bag.
export const adminBagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    Route.version('2024-01-01')
      .get('/checkouts/:checkoutId')
      .validate(z.object({}))
      .responses({
        200: json<APIResponse<V2026_06_09.Admin.Checkout.Checkout>>(),
      })
  )
  .build()

export default bagOfRoutes
