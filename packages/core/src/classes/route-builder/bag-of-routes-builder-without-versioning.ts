import { Versioning } from '../../enums/versioning.js'
import { AnyRouteDef } from '../../types/any-route-def.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteHashMap } from '../../types/route-hash-map.js'
import { HashMap } from '../../utils/hash-map.js'
import { BagOfRoutes } from '../core/bag-of-routes.js'
import { RouteDef } from '../core/route-def.js'

export class BagOfRoutesBuilderWithoutVersioning<TRoutes extends AnyRouteDef> {
  protected routes: RouteHashMap = new HashMap<
    [HTTPMethod, string, string],
    AnyRouteDef
  >((key) => key.join('-'))

  public addRoute<
    TRouteDef extends RouteDef<string, HTTPMethod, string, any, any, unknown>
  >(
    route: TRouteDef
  ): BagOfRoutesBuilderWithoutVersioning<TRoutes | TRouteDef> {
    this.routes.set([route.method, route.path, ''], route)
    return this
  }

  public build() {
    return new BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>(
      this.routes,
      Versioning.NO_VERSIONING,
      null as never
    )
  }
}
