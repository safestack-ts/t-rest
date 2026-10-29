import { AnyRouteDef } from '../../types/any-route-def.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteHashMap } from '../../types/route-hash-map.js'
import { VersioningRequired } from '../../types/versioning-required.js'
import { HashMap } from '../../utils/hash-map.js'
import { BagOfRoutes } from '../core/bag-of-routes.js'
import { RouteDef } from '../core/route-def.js'

const createRouteHashMap = (routes?: RouteHashMap): RouteHashMap =>
  new HashMap<[HTTPMethod, string, string], AnyRouteDef>(
    (key) => key.join('-'),
    Array.from(routes?.entries() ?? [])
  )

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
    this.routes = createRouteHashMap(routes)
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
    builder.routes.set([route.method, route.path, route.version], route)

    return builder
  }

  public build() {
    return new BagOfRoutes<TRoutes, TVersioning, TVersionHistory>(
      createRouteHashMap(this.routes),
      this.versioning,
      this.versionHistory
    )
  }
}
