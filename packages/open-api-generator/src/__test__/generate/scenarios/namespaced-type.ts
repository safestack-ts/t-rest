import { BagOfRoutes, Route } from '@t-rest/core'

namespace Catalog {
  export type ProductCategory = {
    id: number
    name: string
  }
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/categories').response<Catalog.ProductCategory[]>())
  .build()
