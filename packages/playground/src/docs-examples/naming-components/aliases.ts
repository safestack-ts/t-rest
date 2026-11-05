import { BagOfRoutes, json, Route } from '@t-rest/core'
import { defineModels } from '@t-rest/core/zod'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { Customer, Order } from './ids.js'

// Customer and Order already have ids, so these are aliases of them
export const Admin = defineModels('Admin', { Customer, Order })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/admin/orders/:orderId').responses({ 200: json(Admin.Order) })
  )
  .addRoute(
    Route.get('/admin/customers/:customerId').responses({
      200: json(Admin.Customer),
    })
  )
  .build()

export const referenced = buildOpenAPI({
  bag,
  info: { title: 'Admin API' },
  specs: [{ target: '3.1', output: 'openapi/admin.yaml' }],
})

export const materialized = buildOpenAPI({
  bag,
  info: { title: 'Admin API' },
  naming: { aliases: 'materialize' },
  specs: [{ target: '3.1', output: 'openapi/admin.yaml' }],
})
