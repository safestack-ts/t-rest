import { z } from 'zod'
import { BagOfRoutes } from '../../classes/core/bag-of-routes'
import { Route } from '../../classes/core/route'
import { Versioning } from '../../enums/versioning'
import { VersionHistory } from '../version-history'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

export const demoBagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    new Route()
      .version('2024-01-01')
      .get('/basket')
      .response<{ id: string; entries: any[] }>()
  )
  .addRoute(
    new Route()
      .version('2024-01-01')
      .get('/basket/:basketId/entries')
      .validate(z.object({ params: z.object({ basketId: z.string() }) }))
      .response<any[]>()
  )
  .addRoute(
    new Route()
      .version('2024-03-01')
      .post('/basket')
      .validate(
        z.object({
          body: z.object({ entries: z.array(z.object({ id: z.string() })) }),
        })
      )
      .response<{ id: string }>()
  )
  .build()
