import { z } from 'zod'

export const ProductV1 = z
  .object({ id: z.number(), name: z.string() })
  .meta({ id: 'ProductV1' })

export const ProductV2 = z
  .object({
    id: z.number(),
    title: z.string(),
    tags: z.array(z.string()),
    price: z.object({ amount: z.number(), currency: z.enum(['EUR', 'USD']) }),
  })
  .meta({ id: 'ProductV2' })

export const Failure = z.object({ error: z.string() }).meta({ id: 'Failure' })

const productParams = z.object({ params: z.object({ productId: z.string() }) })

/** The bag of `versioned-catalog.bag.ts`, every request and JSON response as a zod schema. */
export const routes = {
  'GET /products @2024-01-01': {
    validator: z.object({
      query: z.object({ page: z.string().optional(), q: z.string() }),
    }),
    responses: { 200: z.array(ProductV1) },
  },
  'GET /products/:productId @2024-01-01': {
    validator: productParams,
    responses: { 200: ProductV1, 404: Failure },
  },
  'GET /products/:productId @2025-01-01': {
    validator: productParams,
    responses: { 200: ProductV2, 404: Failure },
  },
  'GET /products/:productId/manual @2024-01-01': {
    validator: productParams,
    responses: { 404: Failure },
  },
  'GET /products/export @2024-01-01': { responses: {} },
  'DELETE /products/:productId @2025-01-01': {
    validator: productParams,
    responses: { 404: Failure },
  },
}
