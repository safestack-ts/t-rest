import { json, Route } from '@t-rest/core'
import { z } from 'zod'
import { NewProduct, Product } from './schema-metadata.js'

export const createProduct = Route.post('/products')
  .validate(z.object({ body: NewProduct }), {
    examples: {
      coffee: {
        summary: 'A bag of coffee',
        value: {
          body: {
            name: 'Coffee',
            price: 12.9,
            sku: 'COF-0001',
            status: 'draft',
          },
        },
      },
    },
  })
  .responses({ 201: json(Product) })
