import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import type * as Billing from './models/billing.js'
import type * as Identity from './models/identity.js'

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/accounts')
      .validate(z.object({ body: z.custom<Billing.User>() }))
      .response<Identity.User>()
  )
  .build()

export default bagOfRoutes
