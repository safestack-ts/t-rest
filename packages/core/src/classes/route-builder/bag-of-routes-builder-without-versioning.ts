import { Versioning } from '../../enums/versioning.js'
import { createRouteHashMap, storageKeyOf } from '../../internal/route-table.js'
import { AnyRouteDef } from '../../types/any-route-def.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteHashMap } from '../../types/route-hash-map.js'
import { BagOfRoutes } from '../core/bag-of-routes.js'
import { RouteDef } from '../core/route-def.js'

export class BagOfRoutesBuilderWithoutVersioning<TRoutes extends AnyRouteDef> {
  protected readonly routes: RouteHashMap

  constructor(routes?: RouteHashMap) {
    this.routes = createRouteHashMap(routes?.entries())
  }

  public addRoute<
    TRouteDef extends RouteDef<string, HTTPMethod, string, any, any, unknown>
  >(
    route: TRouteDef
  ): BagOfRoutesBuilderWithoutVersioning<TRoutes | TRouteDef> {
    const builder = new BagOfRoutesBuilderWithoutVersioning<
      TRoutes | TRouteDef
    >(this.routes)
    builder.routes.set(storageKeyOf(route, false), route)

    return builder
  }

  public build() {
    return new BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>(
      createRouteHashMap(this.routes.entries()),
      Versioning.NO_VERSIONING,
      null as never
    )
  }
}
