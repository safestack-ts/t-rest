import { BagOfRoutes, Route } from '@t-rest/core'
import { apiKey, bearer, oauth } from './schemes.js'

export const bag = BagOfRoutes.withoutVersioning()
  // the bag default from the generator config
  .addRoute(Route.get('/orders').response(204))
  // public
  .addRoute(Route.get('/health').metaData({ security: [] }).response(204))
  // bearer token or API key
  .addRoute(
    Route.get('/orders/:orderId')
      .metaData({ security: [[bearer], [apiKey]] })
      .response(204)
  )
  // an OAuth token with both scopes
  .addRoute(
    Route.post('/orders')
      .metaData({
        security: [[oauth.scopes('orders:read', 'orders:write')]],
      })
      .response(204)
  )
  // optional: signed-in callers see more
  .addRoute(
    Route.get('/products')
      .metaData({ security: [[bearer], []] })
      .response(204)
  )
  .build()
