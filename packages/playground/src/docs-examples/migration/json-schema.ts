import { json, Route } from '@t-rest/core'
import { z } from 'zod'

const Product = z
  .object({ id: z.number(), name: z.string() })
  .meta({ id: 'Product' })

type ProductBody = { id: number; name: string }

// before: documented as any JSON value, with response/untyped-json
export const before = Route.get('/products').responses({
  200: json<ProductBody[]>(),
})

// after: typed and documented by the schema
export const after = Route.get('/products').responses({
  200: json(z.array(Product)),
})
