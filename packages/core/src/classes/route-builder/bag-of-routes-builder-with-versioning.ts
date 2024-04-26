import { AnyRouteDef } from '../../types/any-route-def'
import { HTTPMethod } from '../../types/http-method'
import { RouteHashMap } from '../../types/route-hash-map'
import { VersioningRequired } from '../../types/versioning-required'
import { HashMap } from '../../utils/hash-map'
import { BagOfRoutes } from '../core/bag-of-routes'
import { RouteDef } from '../core/route-def'

export class BagOfRoutesBuilderWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersioning extends VersioningRequired,
  TVersionHistory extends string[]
> {
  protected routes: RouteHashMap = new HashMap<
    [HTTPMethod, string, string],
    AnyRouteDef
  >((key) => key.join('-'))
  private versioning: TVersioning

  constructor(versioning: TVersioning) {
    this.versioning = versioning
  }

  public addRoute<
    TVersion extends TVersionHistory[number],
    TRouteDef extends RouteDef<TVersion, HTTPMethod, string, any, any, unknown>
  >(
    route: TRouteDef
  ): BagOfRoutesBuilderWithVersioning<
    TRoutes | TRouteDef,
    TVersioning,
    TVersionHistory
  > {
    this.routes.set([route.method, route.path, route.version], route)
    return this
  }

  public build() {
    return new BagOfRoutes<TRoutes, TVersioning>(this.routes, this.versioning)
  }
}
