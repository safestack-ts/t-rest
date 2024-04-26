import {
  AnyRouteDef,
  HTTPMethod,
  StringReplaceHead,
  StringStartsWith,
} from '@typed-rest/core'

type FormatRootPath<TPath extends string> = TPath extends '' ? '/' : TPath

type PossiblePaths<
  TRoutes extends AnyRouteDef,
  TMethod extends HTTPMethod
> = Extract<TRoutes, { method: TMethod }>['path'] extends never
  ? 'No path found for this method'
  : Extract<TRoutes, { method: TMethod }>['path']

export type PossiblePathsFromPrefix<
  TRoutes extends AnyRouteDef,
  TMethod extends HTTPMethod,
  TRoutePrefix extends string
> = FormatRootPath<
  StringReplaceHead<
    StringStartsWith<PossiblePaths<TRoutes, TMethod>, TRoutePrefix>,
    TRoutePrefix extends '/' ? '' : TRoutePrefix,
    ''
  >
>
