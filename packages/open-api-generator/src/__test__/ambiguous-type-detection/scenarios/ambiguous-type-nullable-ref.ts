import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

namespace Checkout {
  export type Address = {
    id: number
    city: string
  }
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/address/non-null')
      .validate(z.object({}))
      .response<Checkout.Address>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/address/nullable')
      .validate(z.object({}))
      .response<Checkout.Address | null>()
  )
  .build()

export default bagOfRoutes
