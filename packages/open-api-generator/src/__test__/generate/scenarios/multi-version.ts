import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'

export const versionHistory = VersionHistory([
  '2024-01-01',
  '2025-01-01',
  '2026-01-01',
] as const)

type ProductV1 = {
  id: number
  name: string
}

type ProductV2 = {
  id: number
  title: string
  tags: string[]
}

type Order = {
  id: number
  productIds: number[]
}

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/products').response<ProductV1[]>()
  )
  .addRoute(
    Route.version('2026-01-01').get('/products').response<ProductV2[]>()
  )
  .addRoute(Route.version('2025-01-01').get('/orders').response<Order[]>())
  .build()
