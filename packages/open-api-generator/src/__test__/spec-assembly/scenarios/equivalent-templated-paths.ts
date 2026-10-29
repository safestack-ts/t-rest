import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .put('/users/:userId')
      .validate(z.object({ params: z.object({ userId: z.string() }) }))
      .response<{ id: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/users/:id')
      .validate(z.object({ params: z.object({ id: z.string() }) }))
      .response<{ id: string }>()
  )
  .build()

export default bagOfRoutes
