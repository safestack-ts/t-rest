import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'

enum OrderStatus {
  PENDING = 'PENDING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/orders')
      .validate(
        z.object({
          query: z.object({
            orderStatus: z.enum(OrderStatus),
          }),
        })
      )
      .response<{}>()
  )
  .build()

const a = z.object({
  query: z.object({
    orderStatus: z.enum(OrderStatus),
  }),
})
type A = z.output<typeof a>
