import { z } from 'zod'
import { combine } from './combine'
import { AssertFalse, IsNever } from 'conditional-type-checks'
import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Route } from '../classes/core/route'
import { ExtractRoutes } from '../types/extract-route'

type User = {
  id: string
  email: string
}

type Basket = {
  id: string
  entries: any[]
  priceTotal: number
}

const bagOfRoutesUsers = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/users').response<User[]>())
  .addRoute(Route.post('/users').response<User>())
  .build()

const bagOfRoutesBaskets = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/baskets/:basketId')
      .validate(z.object({ params: z.object({ basketId: z.string() }) }))
      .response<Basket>()
  )
  .addRoute(Route.post('/baskets').response<Basket>())
  .build()

const bagOfRoutes = combine(bagOfRoutesUsers, bagOfRoutesBaskets)
type Routes = ExtractRoutes<typeof bagOfRoutes>

// every route should be part of the combined bag
type GetUsersRoute = Extract<Routes, { method: 'GET'; path: '/users' }>
type PostUsersRoute = Extract<Routes, { method: 'POST'; path: '/users' }>
type GetBasketsRoute = Extract<
  Routes,
  { method: 'GET'; path: '/baskets/:basketId' }
>
type PostBasketsRoute = Extract<Routes, { method: 'POST'; path: '/baskets' }>

type _test =
  | AssertFalse<IsNever<GetUsersRoute>>
  | AssertFalse<IsNever<PostUsersRoute>>
  | AssertFalse<IsNever<GetBasketsRoute>>
  | AssertFalse<IsNever<PostBasketsRoute>>
