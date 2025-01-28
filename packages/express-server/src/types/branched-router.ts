import { JoinPath, PrefixMatchingRoutes } from '@t-rest/core'
import { TypedRouterBase } from '../classes/typed-router-base'
import { TypedRouterWithVersioning } from '../classes/typed-router-with-versioning'
import { TypedRouterWithoutVersioning } from '../classes/typed-router-without-versioning'

export type BranchedRouter<
  TAppOrRouter extends TypedRouterBase<any, any, any, any>,
  TBranchPath extends string,
  TRequestContext = {}
> = TAppOrRouter extends TypedRouterWithoutVersioning<
  infer TRoutes,
  infer TRequest,
  infer TRouterPrefix
>
  ? TypedRouterWithoutVersioning<
      PrefixMatchingRoutes<TRoutes, JoinPath<TRouterPrefix, TBranchPath>>,
      TRequest & TRequestContext,
      JoinPath<TRouterPrefix, TBranchPath>
    >
  : TAppOrRouter extends TypedRouterWithVersioning<
      infer TRoutes,
      infer TRequest,
      infer TRouterPrefix,
      infer TVersionHistory
    >
  ? TypedRouterWithVersioning<
      PrefixMatchingRoutes<TRoutes, JoinPath<TRouterPrefix, TBranchPath>>,
      TRequest & TRequestContext,
      JoinPath<TRouterPrefix, TBranchPath>,
      TVersionHistory
    >
  : never
