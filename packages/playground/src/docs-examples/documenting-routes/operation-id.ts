import { BagOfRoutes, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

export const bag = BagOfRoutes.withoutVersioning()
  // operationId: listOrders, from meta
  .addRoute(
    Route.get('/orders').metaData({ operationId: 'listOrders' }).response(204)
  )
  // operationId: ordersCancel, from the hook
  .addRoute(Route.post('/orders/:orderId/cancel').response(204))
  // operationId: getOrdersByOrderId, derived from method and path
  .addRoute(Route.get('/orders/:orderId').response(204))
  .build()

export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  operationId: (route) =>
    route.path.endsWith('/cancel') ? 'ordersCancel' : undefined,
  specs: [{ target: '3.1', output: 'openapi/orders.yaml' }],
})
