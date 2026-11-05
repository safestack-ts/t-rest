import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import * as Models from './derived.js'

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/customers/:customerId').responses({
      200: json(Models.CustomerDetails),
    })
  )
  .build()

// naming/model-without-id for CustomerWithNotes
export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  naming: { models: Models },
  specs: [{ target: '3.1', output: 'openapi/shop.yaml' }],
})
