import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'
import { Customer, Order } from './ids.js'

const page = <TItem extends z.ZodType>(item: TItem) =>
  z.object({ items: z.array(item), total: z.int().min(0) })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/orders').responses({ 200: json(page(Order)) }))
  .addRoute(Route.get('/customers').responses({ 200: json(page(Customer)) }))
  .build()

const pageNames: Record<string, string> = {
  '/orders': 'Shop_OrderPage',
  '/customers': 'Shop_CustomerPage',
}

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  naming: {
    nameAnonymous: (context) =>
      context.kind === 'slot' && context.slot === 'response 200'
        ? pageNames[context.operation.path]
        : undefined,
  },
  specs: [{ target: '3.1', output: 'openapi/shop.yaml' }],
})
