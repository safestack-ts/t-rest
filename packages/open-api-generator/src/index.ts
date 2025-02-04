import { parseBagOfRoutes } from './utils/parse-bag-of-routes'

const routeTypes = parseBagOfRoutes('./src/bag.ts')

console.log(JSON.stringify(routeTypes, null, 2))
