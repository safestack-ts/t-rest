import { AnyRouteDef } from '@t-rest/core'
import type { TypedRouterWithVersioning } from '../classes/typed-router-with-versioning.js'
import type { TypedRouterWithoutVersioning } from '../classes/typed-router-without-versioning.js'
import { ExpressRequest } from './express-type-shortcuts.js'

export type TypedRouterModuleWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TPath extends string,
  TContext extends ExpressRequest
> = {
  readonly type: 'withoutVersioning'
  readonly path: TPath
  configure(
    router: TypedRouterWithoutVersioning<TRoutes, TContext, TPath>
  ): void
}

export type TypedRouterModuleWithVersioning<
  TRoutes extends AnyRouteDef,
  TPath extends string,
  TContext extends ExpressRequest,
  TVersionHistory extends string[]
> = {
  readonly type: 'withVersioning'
  readonly path: TPath
  configure(
    router: TypedRouterWithVersioning<
      TRoutes,
      TContext,
      TPath,
      TVersionHistory
    >
  ): void
}
