import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'

type PublicProduct = {
  id: number
}

type InternalProduct = {
  id: number
  costPrice: number
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/products')
      .metaData({ summary: 'List products', public: true })
      .response<PublicProduct[]>()
  )
  .addRoute(
    Route.post('/products')
      .validate(z.object({ body: z.object({ id: z.number() }) }))
      .metaData({ summary: 'Create product', public: false })
      .response<PublicProduct>()
  )
  .addRoute(
    Route.get('/internal/products')
      .metaData({ public: 'yes' })
      .response<InternalProduct[]>()
  )
  .addRoute(Route.get('/health').response<{ ok: boolean }>())
  .build()
