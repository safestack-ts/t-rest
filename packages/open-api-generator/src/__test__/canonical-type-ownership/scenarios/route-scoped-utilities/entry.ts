import { BagOfRoutes, Route, Versioning } from '@t-rest/core'
import { z } from 'zod'
import type * as V2024_01_01 from './models/2024_01_01/index.js'
import { parseCheckSearchOpts } from './query-utilities/search-opts.js'

export * from './models/index.js'

const querySchema = z.object({
  query: z.object({ search: parseCheckSearchOpts.optional() }),
})

export default BagOfRoutes.withVersioning(Versioning.DATE, ['2024-01-01'])
  .addRoute(
    Route.version('2024-01-01')
      .get('/api/orders/admin/export')
      .validate(querySchema)
      .response<V2024_01_01.Admin.Order.Order[]>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/api/capacities/slots/admin/export')
      .validate(querySchema)
      .response<V2024_01_01.Admin.Capacity.Capacity[]>()
  )
  .build()
