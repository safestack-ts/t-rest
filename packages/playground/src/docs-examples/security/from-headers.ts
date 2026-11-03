import { BagOfRoutes, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'
import { bearer } from './schemes.js'

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/orders')
      .validate(z.object({ headers: z.object({ authorization: z.string() }) }))
      .response(204)
  )
  .addRoute(
    Route.get('/products')
      .validate(
        z.object({
          headers: z.object({ authorization: z.string().optional() }),
        })
      )
      .response(204)
  )
  .build()

// GET /orders gets [[bearer]], GET /products gets [[bearer], []], and
// neither documents an authorization header parameter
export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  securityFromHeaders: { authorization: bearer },
  specs: [{ target: '3.1', output: 'openapi/orders.yaml' }],
})
