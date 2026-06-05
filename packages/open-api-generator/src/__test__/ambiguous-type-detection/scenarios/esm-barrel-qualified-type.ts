import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { V2026_06_09 } from './esm-barrel-models/2026_06_09.js'

type APIResponse<T> = {
  data: T
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/admin/keycards/:keycardId')
      .validate(z.object({}))
      .response<APIResponse<V2026_06_09.Admin.Keycard.Keycard>>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/customer/keycards/:keycardId')
      .validate(z.object({}))
      .response<APIResponse<V2026_06_09.Customer.Keycard.Keycard>>()
  )
  .build()

export default bagOfRoutes
