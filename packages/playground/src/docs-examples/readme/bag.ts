import { BagOfRoutes, json, Route } from '@t-rest/core'
import { z } from 'zod'

const Product = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'Product' })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/products')
      .metaData({ public: true })
      .responses({ 200: json(z.array(Product)) })
  )
  .addRoute(
    Route.delete('/products/:productId')
      .metaData({ public: false })
      .response(204)
  )
  .build()
