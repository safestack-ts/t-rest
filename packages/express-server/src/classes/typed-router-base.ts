import { AnyRouteDef, RouteHashMap } from "@typed-rest/core";
import { ExpressRequest, ExpressRouter } from "../types/express-type-shortcuts";
import { VersionedRouting } from "./versioned-routing";

export abstract class TypedRouterBase<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string,
  TVersionHistory extends string[]
> {
  public readonly routes: RouteHashMap;
  public readonly expressRouter: ExpressRouter;
  protected readonly path: TPath;
  public abstract readonly routing: VersionedRouting;
  protected readonly versionHistory: TVersionHistory;

  constructor(
    routes: RouteHashMap,
    router: ExpressRouter,
    path: TPath,
    versionHistory: TVersionHistory
  ) {
    this.routes = routes;
    this.expressRouter = router;
    this.path = path;
    this.versionHistory = versionHistory;
  }

  public get fullPath() {
    return this.path;
  }
}
