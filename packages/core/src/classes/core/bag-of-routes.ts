import { Versioning } from '../../enums/versioning'
import { AnyRouteDef } from '../../types/any-route-def'
import { RouteHashMap } from '../../types/route-hash-map'
import { VersioningRequired } from '../../types/versioning-required'
import { BagOfRoutesBuilderWithVersioning } from '../route-builder/bag-of-routes-builder-with-versioning'
import { BagOfRoutesBuilderWithoutVersioning } from '../route-builder/bag-of-routes-builder-without-versioning'

export class BagOfRoutes<
  _TRoutes extends AnyRouteDef,
  TVersioning extends Versioning
> {
  public readonly routes: RouteHashMap
  public readonly versioning: TVersioning

  constructor(routes: RouteHashMap, versioning: TVersioning) {
    this.routes = routes
    this.versioning = versioning
  }

  public static withVersioning<
    TVersioning extends VersioningRequired,
    TVersionHistory extends string[]
  >(versioning: TVersioning) {
    return new BagOfRoutesBuilderWithVersioning<
      never,
      TVersioning,
      TVersionHistory
    >(versioning)
  }

  public static withoutVersioning() {
    return new BagOfRoutesBuilderWithoutVersioning<never>()
  }
}
