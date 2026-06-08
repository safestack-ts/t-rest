import {
  AnyRouteDef,
  BagOfRoutes,
  PrefixMatchingRoutes,
  Versioning,
  VersioningRequired,
} from '@t-rest/core'
import {
  TypedRouterModuleWithVersioning,
  TypedRouterModuleWithoutVersioning,
} from '../types/typed-router-module.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'
import type { TypedRouterWithVersioning } from '../classes/typed-router-with-versioning.js'
import type { TypedRouterWithoutVersioning } from '../classes/typed-router-without-versioning.js'

type ContextRequest<TContext> = ExpressRequest & TContext

type MatchingPath<TRoutes extends AnyRouteDef, TPath extends string> =
  PrefixMatchingRoutes<TRoutes, TPath> extends never ? never : TPath

class RouterModuleBuilderWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TPath extends string,
  TContext
> {
  constructor(private readonly path: TPath) {}

  public withContext<TNextContext>() {
    return new RouterModuleBuilderWithoutVersioning<
      TRoutes,
      TPath,
      TNextContext
    >(this.path)
  }

  public configure(
    configureRouter: (
      router: TypedRouterWithoutVersioning<
        PrefixMatchingRoutes<TRoutes, TPath>,
        ContextRequest<TContext>,
        TPath
      >
    ) => void
  ): TypedRouterModuleWithoutVersioning<
    PrefixMatchingRoutes<TRoutes, TPath>,
    TPath,
    ContextRequest<TContext>
  > {
    return {
      type: 'withoutVersioning',
      path: this.path,
      configure: configureRouter,
    }
  }
}

class RouterModuleBuilderWithVersioning<
  TRoutes extends AnyRouteDef,
  TPath extends string,
  TContext,
  TVersionHistory extends string[]
> {
  constructor(private readonly path: TPath) {}

  public withContext<TNextContext>() {
    return new RouterModuleBuilderWithVersioning<
      TRoutes,
      TPath,
      TNextContext,
      TVersionHistory
    >(this.path)
  }

  public configure(
    configureRouter: (
      router: TypedRouterWithVersioning<
        PrefixMatchingRoutes<TRoutes, TPath>,
        ContextRequest<TContext>,
        TPath,
        TVersionHistory
      >
    ) => void
  ): TypedRouterModuleWithVersioning<
    PrefixMatchingRoutes<TRoutes, TPath>,
    TPath,
    ContextRequest<TContext>,
    TVersionHistory
  > {
    return {
      type: 'withVersioning',
      path: this.path,
      configure: configureRouter,
    }
  }
}

class DefineRouterModuleWithoutVersioning<TRoutes extends AnyRouteDef> {
  public at<TPath extends `/${string}`>(
    path: MatchingPath<TRoutes, TPath>
  ): RouterModuleBuilderWithoutVersioning<TRoutes, TPath, unknown> {
    return new RouterModuleBuilderWithoutVersioning<TRoutes, TPath, unknown>(
      path
    )
  }
}

class DefineRouterModuleWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersionHistory extends string[]
> {
  public at<TPath extends `/${string}`>(
    path: MatchingPath<TRoutes, TPath>
  ): RouterModuleBuilderWithVersioning<
    TRoutes,
    TPath,
    unknown,
    TVersionHistory
  > {
    return new RouterModuleBuilderWithVersioning<
      TRoutes,
      TPath,
      unknown,
      TVersionHistory
    >(path)
  }
}

export function defineRouterModule<TRoutes extends AnyRouteDef>(
  _bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>
): DefineRouterModuleWithoutVersioning<TRoutes>

export function defineRouterModule<
  TRoutes extends AnyRouteDef,
  TVersionHistory extends string[]
>(
  _bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>
): DefineRouterModuleWithVersioning<TRoutes, TVersionHistory>

export function defineRouterModule(bagOfRoutes: BagOfRoutes<any, any, any>) {
  if (bagOfRoutes.versioning === Versioning.NO_VERSIONING) {
    return new DefineRouterModuleWithoutVersioning()
  }

  return new DefineRouterModuleWithVersioning()
}
