import { Route } from '@t-rest/core'

// RouteMeta keys are checked, other keys keep their own type
export const route = Route.get('/products')
  .metaData({ summary: 'List products', public: true })
  .response(204)

export const meta: { summary: string; public: boolean } = route.metaData
