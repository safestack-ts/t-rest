import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from '../../ambiguous-type-detection/scenarios/esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

// The selected member is only populated with the argument of the wrapper call
// after initialization, so the routes passed at the call site must still
// determine the naming.
function wrap<T>(customer: T) {
  const result = { customer: null as unknown as T }
  result.customer = customer
  return result
}

export default wrap(
  BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
    .addRoute(
      Route.version('2024-01-01')
        .get('/accounts/:accountId')
        .validate(z.object({}))
        .response<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>()
    )
    .build()
).customer
