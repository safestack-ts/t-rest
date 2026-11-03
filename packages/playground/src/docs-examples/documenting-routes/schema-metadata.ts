import { z } from 'zod'

export const Product = z
  .object({
    id: z.uuid().describe('Assigned by the server'),
    name: z.string().min(1).max(120),
    price: z
      .number()
      .positive()
      .meta({ examples: [12.9] }),
    sku: z.string().regex(/^[A-Z]{3}-\d{4}$/),
    status: z
      .enum(['draft', 'active'])
      .meta({ 'x-enum-varnames': ['Draft', 'Active'] }),
    legacyCode: z.string().optional().meta({ deprecated: true }),
  })
  .meta({ id: 'Catalog_Product', title: 'Product', description: 'A product' })

export const NewProduct = Product.omit({ id: true }).meta({
  id: 'Catalog_NewProduct',
})
