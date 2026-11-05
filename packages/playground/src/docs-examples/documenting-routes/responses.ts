import { binary, empty, json, Route, text } from '@t-rest/core'
import { z } from 'zod'
import { Product } from './schema-metadata.js'

export const getProduct = Route.get('/products/:productId')
  .validate(z.object({ params: z.object({ productId: z.uuid() }) }))
  .responses({
    200: json(Product, {
      description: 'The product',
      headers: z.object({
        etag: z.string().describe('Version of the product'),
        'cache-control': z.string().optional(),
      }),
      examples: {
        coffee: {
          summary: 'A bag of coffee',
          value: {
            id: '7f6c1d2e-8a4b-4c3d-9e2f-1a2b3c4d5e6f',
            name: 'Coffee',
            price: 12.9,
            sku: 'COF-0001',
            status: 'active',
          },
        },
      },
    }),
    304: empty({ description: 'The product did not change' }),
    404: text('text/plain', { description: 'No product with this id' }),
  })

export const getManual = Route.get('/products/:productId/manual')
  .validate(z.object({ params: z.object({ productId: z.uuid() }) }))
  .responses({
    200: binary('application/pdf', { description: 'The manual as PDF' }),
  })
