import { defineModels } from '@t-rest/core/zod'
import { z } from 'zod'

export const V2024_01_01_Shared = defineModels('V2024_01_01.Shared', {
  Price: z.object({
    amount: z.number().describe('Minor units, e.g. cents'),
    currency: z.enum(['CHF', 'EUR']),
  }),
  Problem: z.object({
    message: z.string(),
    issues: z.array(z.string()).optional(),
  }),
})

const Product = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  price: V2024_01_01_Shared.Price,
})

export const V2024_01_01_Catalog = defineModels('V2024_01_01.Catalog', {
  Product,
  NewProduct: Product.omit({ id: true }),
})

// 2025-01-01 keeps the catalog models and adds stock. Re-exporting a model
// keeps its id, so both versions share one component.
export const V2025_01_01_Catalog = {
  ...V2024_01_01_Catalog,
  ...defineModels('V2025_01_01.Catalog', {
    Stock: z.object({ productId: z.uuid(), available: z.int().min(0) }),
  }),
}

export const V2025_01_01_Admin = defineModels('V2025_01_01.Admin', {
  // an alias: its own component that refers to the catalog product
  Product: V2024_01_01_Catalog.Product,
})
