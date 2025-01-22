import { AnyRouteDef, BagOfRoutes, Versioning } from '@t-rest/core'
import { ExpressApp, ExpressRequest } from '../types/express-type-shortcuts'
import { TypedRouterWithoutVersioning } from './typed-router-without-versioning'

export class TypedExpressApplicationWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest
> extends TypedRouterWithoutVersioning<TRoutes, TRequest, '/'> {
  protected readonly bagOfRoutes: BagOfRoutes<TRoutes, Versioning, never>

  constructor(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>
  ) {
    super(bagOfRoutes.routes, expressApp, '/')

    this.bagOfRoutes = bagOfRoutes
  }
}
