import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

namespace CatalogAlpha {
  export type ProductCategory = {
    id: number
    name: string
  }
}

namespace CatalogBeta {
  export type ProductCategory = {
    name: string
    id: number
  }
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/categories/source-a')
      .validate(z.object({}))
      .response<CatalogAlpha.ProductCategory>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/categories/source-b')
      .validate(z.object({}))
      .response<CatalogBeta.ProductCategory>()
  )
  .build()

export default bagOfRoutes
