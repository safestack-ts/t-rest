import { z } from 'zod'
import { combine } from './combine'
import { AssertFalse, AssertTrue, IsNever } from 'conditional-type-checks'
import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Route } from '../classes/core/route'
import { ExtractRoutes } from '../types/extract-route'
import { Versioning } from '../enums/versioning'
import { versionHistory } from './dx/demo-bag-of-routes'

type User = {
  id: string
  email: string
}

type Basket = {
  id: string
  entries: any[]
  priceTotal: number
}

namespace _WithoutVersioning {
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
}

namespace _WithVersioning {
  const bagOfRoutesUsers = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(Route.version('2024-01-01').get('/users').response<User[]>())
    .addRoute(Route.version('2024-01-01').post('/users').response<User>())
    .build()

  const bagOfRoutesBaskets = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01').get('/baskets/:basketId').response<Basket>()
    )
    .addRoute(Route.version('2024-01-01').post('/baskets').response<Basket>())
    .build()

  const bagOfRoutes = combine(bagOfRoutesUsers, bagOfRoutesBaskets)
  type BagOfRoutesType = typeof bagOfRoutes
  type Routes = ExtractRoutes<BagOfRoutesType>

  type GetUsersRoute = Extract<
    Routes,
    { method: 'GET'; path: '/users'; version: '2024-01-01' }
  >
  type PostUsersRoute = Extract<
    Routes,
    { method: 'POST'; path: '/users'; version: '2024-01-01' }
  >
  type GetBasketsRoute = Extract<
    Routes,
    { method: 'GET'; path: '/baskets/:basketId'; version: '2024-01-01' }
  >
  type PostBasketsRoute = Extract<
    Routes,
    { method: 'POST'; path: '/baskets'; version: '2024-01-01' }
  >

  type BagOfRoutesVersioning = BagOfRoutesType extends BagOfRoutes<
    any,
    infer TVersioning,
    any
  >
    ? TVersioning
    : never
  type VersioningIsDateVersioning =
    BagOfRoutesVersioning extends Versioning.DATE ? true : false

  type _test =
    | AssertFalse<IsNever<GetUsersRoute>>
    | AssertFalse<IsNever<PostUsersRoute>>
    | AssertFalse<IsNever<GetBasketsRoute>>
    | AssertFalse<IsNever<PostBasketsRoute>>
    | AssertTrue<VersioningIsDateVersioning>
}

namespace _WithVersioningDifferentVersioning {
  const bagOfRoutesUsers = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(Route.version('2024-01-01').get('/users').response<User[]>())
    .build()

  const bagOfRoutesBaskets = BagOfRoutes.withVersioning(Versioning.SEMVER, [
    '1.0.0',
  ])
    .addRoute(
      Route.version('1.0.0').get('/baskets/:basketId').response<Basket>()
    )
    .build()

  // @ts-expect-error
  combine(bagOfRoutesUsers, bagOfRoutesBaskets)
}
