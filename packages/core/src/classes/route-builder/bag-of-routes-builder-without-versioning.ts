import { Versioning } from '../../enums/versioning.js'
import { AnyRouteDef } from '../../types/any-route-def.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteHashMap } from '../../types/route-hash-map.js'
import { HashMap } from '../../utils/hash-map.js'
import { BagOfRoutes } from '../core/bag-of-routes.js'
import { RouteDef } from '../core/route-def.js'

const createRouteHashMap = (routes?: RouteHashMap): RouteHashMap =>
  new HashMap<[HTTPMethod, string, string], AnyRouteDef>(
    (key) => key.join('-'),
    Array.from(routes?.entries() ?? [])
  )

export class BagOfRoutesBuilderWithoutVersioning<TRoutes extends AnyRouteDef> {
  protected readonly routes: RouteHashMap

  constructor(routes?: RouteHashMap) {
    this.routes = createRouteHashMap(routes)
  }

  public addRoute<
    TRouteDef extends RouteDef<string, HTTPMethod, string, any, any, unknown>
  >(
    route: TRouteDef
  ): BagOfRoutesBuilderWithoutVersioning<TRoutes | TRouteDef> {
    const builder = new BagOfRoutesBuilderWithoutVersioning<
      TRoutes | TRouteDef
    >(this.routes)
    builder.routes.set([route.method, route.path, ''], route)

    return builder
  }

  public build() {
    return new BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>(
      createRouteHashMap(this.routes),
      Versioning.NO_VERSIONING,
      null as never
    )
  }
}
