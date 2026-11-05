import {
  BagOfRoutes,
  json,
  Route,
  securityScheme,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { z } from 'zod'
import {
  V2024_01_01_Shared,
  V2024_01_01_Catalog,
  V2025_01_01_Admin,
  V2025_01_01_Catalog,
} from './models.js'

export const bearer = securityScheme('bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

export const oauth = securityScheme('oauth', {
  type: 'oauth2',
  flows: {
    clientCredentials: {
      tokenUrl: 'https://auth.shop.dev/token',
      scopes: { 'catalog:write': 'Change the catalog' },
    },
  },
})

const versions = VersionHistory(['2024-01-01', '2025-01-01'] as const)

const productParams = z.object({ params: z.object({ productId: z.uuid() }) })

export const bag = BagOfRoutes.withVersioning(Versioning.DATE, versions)
  .addRoute(
    Route.version('2024-01-01')
      .get('/products')
      .metaData({
        summary: 'List products',
        tags: ['catalog'],
        public: true,
        security: [],
      })
      .responses({ 200: json(z.array(V2024_01_01_Catalog.Product)) })
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/products/:productId')
      .metaData({
        summary: 'Get a product',
        tags: ['catalog'],
        public: true,
        security: [[bearer], []],
      })
      .validate(productParams)
      .responses({
        200: json(V2024_01_01_Catalog.Product, {
          description: 'The product',
          headers: z.object({ etag: z.string() }),
        }),
        404: json(V2024_01_01_Shared.Problem, {
          description: 'No product with this id',
        }),
      })
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/products')
      .metaData({
        summary: 'Create a product',
        tags: ['catalog'],
        security: [[oauth.scopes('catalog:write')]],
      })
      .validate(z.object({ body: V2024_01_01_Catalog.NewProduct }), {
        examples: {
          coffee: {
            summary: 'A bag of coffee',
            value: {
              body: {
                name: 'Coffee',
                price: { amount: 1290, currency: 'CHF' },
              },
            },
          },
        },
      })
      .responses({ 201: json(V2024_01_01_Catalog.Product) })
  )
  .addRoute(
    Route.version('2025-01-01')
      .get('/products/:productId/stock')
      .metaData({ summary: 'Get the stock', tags: ['catalog'], public: true })
      .validate(productParams)
      .responses({ 200: json(V2025_01_01_Catalog.Stock) })
  )
  .addRoute(
    Route.version('2025-01-01')
      .get('/admin/products/:productId')
      .metaData({ summary: 'Get a product as admin', tags: ['admin'] })
      .validate(productParams)
      .responses({ 200: json(V2025_01_01_Admin.Product) })
  )
  .build()
  .withDefaultResponses({
    400: json(V2024_01_01_Shared.Problem, {
      id: 'BadRequest',
      description: 'The request does not match the route validator',
    }),
  })
