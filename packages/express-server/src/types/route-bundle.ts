import { AnyRouteDef } from "@typed-rest/core";
import { AnyRouteHandlerFn } from "./any-route-handler-fn";
import { TypedMiddleware } from "./typed-middleware";

export type RouteBundle = {
  route: AnyRouteDef;
  handler: AnyRouteHandlerFn;
  middlewares: TypedMiddleware<any, any>[];
};
