import { AnyRouteDef, HTTPMethod } from "@typed-rest/core";

export type RouteVersions<
  TRoutes extends AnyRouteDef,
  TMethod extends HTTPMethod,
  TPath extends string
> = Extract<TRoutes, { method: TMethod; path: TPath }>["version"];
