import { BagOfRoutes, Route } from '@t-rest/core'

type Zebra = {
  stripes: number
}

type Mango = {
  ripe: boolean
}

type Apple = {
  color: string
}

type Kiwi = {
  zebra: Zebra
  apple: Apple
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/zebra').response<Zebra>())
  .addRoute(Route.get('/mango').response<Mango>())
  .addRoute(Route.get('/kiwi').response<Kiwi>())
  .build()
