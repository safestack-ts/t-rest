import { BagOfRoutes, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/orders')
      .metaData({
        summary: 'List orders',
        description: 'Newest first.',
        tags: ['orders'],
        externalDocs: { url: 'https://docs.shop.dev/orders' },
        // keys outside RouteMeta keep their own type
        audience: 'public',
        'x-rate-limit': 100,
      })
      .response(204)
  )
  .addRoute(
    Route.delete('/orders')
      .metaData({ deprecated: true, audience: 'internal' })
      .response(204)
  )
  .build()

export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  tags: [{ name: 'orders', description: 'Orders of a customer' }],
  specs: [
    {
      target: '3.1',
      output: 'openapi/public.yaml',
      // route.meta.audience is string | undefined
      filter: (route) => route.meta.audience === 'public',
    },
  ],
})
