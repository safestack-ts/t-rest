import { AnyRouteDef, BagOfRoutes, Versioning } from '@t-rest/core'
import {
  ExpressApp,
  ExpressRequest,
  ExpressRouter,
} from '../types/express-type-shortcuts'
import { TypedRouterWithoutVersioning } from './typed-router-without-versioning'

export class TypedExpressApplicationWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TMountPath extends string
> extends TypedRouterWithoutVersioning<TRoutes, TRequest, TMountPath> {
  public readonly expressApp: ExpressApp | ExpressRouter

  protected readonly bagOfRoutes: BagOfRoutes<TRoutes, Versioning, never>

  constructor(
    expressApp: ExpressApp | ExpressRouter,
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>,
    mountPath: TMountPath
  ) {
    super(bagOfRoutes.routes, expressApp, mountPath)

    this.expressApp = expressApp
    this.bagOfRoutes = bagOfRoutes
  }
}
