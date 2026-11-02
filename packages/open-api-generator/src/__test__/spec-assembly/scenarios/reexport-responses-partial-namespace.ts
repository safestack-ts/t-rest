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

type Failure = {
  error: string
}

// only the first status declares a namespace, the second must not take it
const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/checkouts/:checkoutId')
      .validate(z.object({}))
      .responses({
        200: json<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>(),
        404: json<Failure>(),
      })
  )
  .build()

export default bagOfRoutes
