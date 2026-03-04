import { Versioning } from '../../enums/versioning.js'
import { AnyRouteDef } from '../../types/any-route-def.js'
import { RouteHashMap } from '../../types/route-hash-map.js'
import { VersioningRequired } from '../../types/versioning-required.js'
import { BagOfRoutesBuilderWithVersioning } from '../route-builder/bag-of-routes-builder-with-versioning.js'
import { BagOfRoutesBuilderWithoutVersioning } from '../route-builder/bag-of-routes-builder-without-versioning.js'

export class BagOfRoutes<
  _TRoutes extends AnyRouteDef,
  TVersioning extends Versioning,
  TVersionHistory extends string[]
> {
  public readonly routes: RouteHashMap
  public readonly versioning: TVersioning
  // @todo can we move that into two BagOfRoutes classes?
  public readonly versionHistory: TVersionHistory

  constructor(
    routes: RouteHashMap,
    versioning: TVersioning,
    versionHistory: TVersionHistory
  ) {
    this.routes = routes
    this.versioning = versioning
    this.versionHistory = versionHistory
  }

  public static withVersioning<
    TVersioning extends VersioningRequired,
    TVersionHistory extends string[]
  >(versioning: TVersioning, versionHistory: TVersionHistory) {
    return new BagOfRoutesBuilderWithVersioning<
      never,
      TVersioning,
      TVersionHistory
    >(versioning, versionHistory)
  }

  public static withoutVersioning() {
    return new BagOfRoutesBuilderWithoutVersioning<never>()
  }
}
