import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from '../../ambiguous-type-detection/scenarios/esm-barrel-reexport-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/checkouts')
      .validate(
        z.object({
          body: z.custom<V2026_06_09.Admin.Checkout.Checkout>(),
        })
      )
      .response<APIResponse<V2026_06_09.Customer.Checkout.Checkout>>()
  )
  .build()

export default bagOfRoutes
