import { z } from 'zod'

export const Customer = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'Shop_Customer' })

export const Order = z
  .object({ id: z.uuid(), customer: Customer, total: z.number() })
  .meta({ id: 'Shop_Order' })
