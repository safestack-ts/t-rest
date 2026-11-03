import {
  BagOfRoutes,
  binary,
  empty,
  json,
  Route,
  text,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { z } from 'zod'

export const versionHistory = VersionHistory([
  '2024-01-01',
  '2025-01-01',
] as const)

export type ProductV1 = {
  id: number
  name: string
}

export type ProductV2 = {
  id: number
  title: string
  tags: string[]
  price: { amount: number; currency: 'EUR' | 'USD' }
}

export type Failure = {
  error: string
}

const productParams = z.object({ params: z.object({ productId: z.string() }) })

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/products')
      .validate(
        z.object({
          query: z.object({ page: z.string().optional(), q: z.string() }),
        })
      )
      .response<ProductV1[]>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/products/:productId')
      .validate(productParams)
      .responses({ 200: json<ProductV1>(), 404: json<Failure>() })
  )
  .addRoute(
    Route.version('2025-01-01')
      .get('/products/:productId')
      .validate(productParams)
      .responses({ 200: json<ProductV2>(), 404: json<Failure>() })
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/products/:productId/manual')
      .validate(productParams)
      .responses({ 200: binary('application/pdf'), 404: json<Failure>() })
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/products/export')
      .responses({ 200: text('text/csv'), 202: text() })
  )
  .addRoute(
    Route.version('2025-01-01')
      .delete('/products/:productId')
      .validate(productParams)
      .responses({ 204: empty(), 404: json<Failure>() })
  )
  .build()
