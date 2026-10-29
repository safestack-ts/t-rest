import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from '../../ambiguous-type-detection/scenarios/esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/customer/checkouts/:checkoutId')
      .validate(z.object({}))
      .response<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>()
  )
  .build()

export default bagOfRoutes
