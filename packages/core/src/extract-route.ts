import {
  AnyRouteDef,
  BagOfRoutes,
  BagOfRoutesWithVersioning,
  BagOfRoutesWithoutVersioning,
  HTTPMethod,
  Versioning,
  VersioningRequired,
} from "./index";

export type ExtractRoutes<TBagOfRoutes extends BagOfRoutes<AnyRouteDef, any>> =
  TBagOfRoutes extends BagOfRoutesWithVersioning<infer TRoutes, any>
    ? TRoutes
    : TBagOfRoutes extends BagOfRoutesWithoutVersioning<infer TRoutes>
    ? TRoutes
    : never;

export type ExtractRoute<
  TBagOfRoutes,
  TMethod extends HTTPMethod,
  TPath extends string
> = TBagOfRoutes extends BagOfRoutes<AnyRouteDef, Versioning>
  ? Extract<ExtractRoutes<TBagOfRoutes>, { method: TMethod; path: TPath }>
  : never;
