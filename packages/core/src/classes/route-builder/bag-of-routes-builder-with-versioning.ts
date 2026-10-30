import { createRouteHashMap, storageKeyOf } from '../../internal/route-table.js'
import { AnyRouteDef } from '../../types/any-route-def.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteHashMap } from '../../types/route-hash-map.js'
import { VersioningRequired } from '../../types/versioning-required.js'
import { BagOfRoutes } from '../core/bag-of-routes.js'
import { RouteDef } from '../core/route-def.js'

export class BagOfRoutesBuilderWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersioning extends VersioningRequired,
  TVersionHistory extends string[]
> {
  protected readonly routes: RouteHashMap
  private readonly versioning: TVersioning
  private readonly versionHistory: TVersionHistory

  constructor(
    versioning: TVersioning,
    versionHistory: TVersionHistory,
    routes?: RouteHashMap
  ) {
    this.versioning = versioning
    this.versionHistory = versionHistory
    this.routes = createRouteHashMap(routes?.entries())
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
    const builder = new BagOfRoutesBuilderWithVersioning<
      TRoutes | TRouteDef,
      TVersioning,
      TVersionHistory
    >(this.versioning, this.versionHistory, this.routes)
    builder.routes.set(storageKeyOf(route, true), route)

    return builder
  }

  public build() {
    return new BagOfRoutes<TRoutes, TVersioning, TVersionHistory>(
      createRouteHashMap(this.routes.entries()),
      this.versioning,
      this.versionHistory
    )
  }
}
