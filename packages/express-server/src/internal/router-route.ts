import {
  AnyRouteDef,
  HTTPMethod,
  JoinPath,
  WithoutDoubleSlash,
  WithoutTrailingSlash,
} from '@t-rest/core'

// the routes a router selects with a method and a path relative to the router
export type RouterRoute<
  TRoutes extends AnyRouteDef,
  TMethod extends HTTPMethod,
  TPath extends string,
  TPathSuffix extends string
> = Extract<
  TRoutes,
  {
    method: TMethod
    path: WithoutDoubleSlash<WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>>
  }
>
