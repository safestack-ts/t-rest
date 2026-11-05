import {
  BagOfRoutes,
  securityScheme,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'
import { getAddress, getCustomerAddress } from './after-routes.js'

export const bag = BagOfRoutes.withVersioning(
  Versioning.DATE,
  VersionHistory(['2024-01-01', '2025-01-01'] as const)
)
  .addRoute(getAddress)
  .addRoute(getCustomerAddress)
  .build()

const bearer = securityScheme('bearer', { type: 'http', scheme: 'bearer' })

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API', description: 'The shop' },
  headers: z.object({ 'x-client-id': z.string() }),
  securityFromHeaders: { authorization: bearer },
  specs: [
    {
      version: '2025-01-01',
      target: '3.0',
      output: 'docs/openapi.yaml',
      filter: (route) => !route.path.startsWith('/admin'),
    },
  ],
})
