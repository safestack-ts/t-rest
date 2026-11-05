import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

export const bag = BagOfRoutes.withVersioning(
  Versioning.DATE,
  VersionHistory(['2024-01-01', '2025-01-01'] as const)
)
  .addRoute(Route.version('2024-01-01').get('/products').response(204))
  .addRoute(Route.version('2025-01-01').get('/orders').response(204))
  .build()

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  specs: [
    // openapi/2024-01-01.json and openapi/2025-01-01.json
    { versions: 'all', target: '3.0', output: 'openapi/{version}.json' },
    // the newest version, 2025-01-01
    { target: '3.1', output: 'openapi/latest.yaml' },
  ],
})
