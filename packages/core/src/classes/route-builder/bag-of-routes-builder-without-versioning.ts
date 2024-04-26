import { Versioning } from '../../enums/versioning'
import { AnyRouteDef } from '../../types/any-route-def'
import { HTTPMethod } from '../../types/http-method'
import { RouteHashMap } from '../../types/route-hash-map'
import { HashMap } from '../../utils/hash-map'
import { BagOfRoutes } from '../core/bag-of-routes'
import { RouteDef } from '../core/route-def'

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
    return new BagOfRoutes<TRoutes, Versioning.NO_VERSIONING>(
      this.routes,
      Versioning.NO_VERSIONING
    )
  }
}
