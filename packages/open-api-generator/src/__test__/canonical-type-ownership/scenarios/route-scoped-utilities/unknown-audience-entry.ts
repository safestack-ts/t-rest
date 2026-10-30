import { BagOfRoutes, Route, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { parseCheckSearchOpts } from './query-utilities/search-opts.js'

export * from './models/index.js'

export default BagOfRoutes.withVersioning(Versioning.DATE, ['2024-01-01'])
  .addRoute(
    Route.version('2024-01-01')
      .get('/api/orders/export')
      .validate(
        z.object({
          query: z.object({ search: parseCheckSearchOpts.optional() }),
        })
      )
      .response<{ url: string }>()
  )
  .build()
