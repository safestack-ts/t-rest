import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from '../../ambiguous-type-detection/scenarios/esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

// The sibling admin bag defines the same route key and comes first. Only the
// exported customer property may determine the naming of the exported bag.
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

export const adminBagOfRoutes = bags.admin

export default bags.customer
