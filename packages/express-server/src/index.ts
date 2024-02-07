import * as Express from "express";
import {
  AnyRouteDef,
  BagOfRoutes,
  HTTPMethod,
  HashMap,
  JoinPath,
  ResponseTypeKey,
  RouteDef,
  RouteHashMap,
  StringReplaceHead,
  StringStartsWith,
  VersionHistory,
  Versioning,
  WithoutTrailingSlash,
  demoBagOfRoutes,
  joinPath,
  typedLowerCase,
} from "@typed-rest/core";
import cors from "cors";
import * as z from "zod";
import { StatusCodes } from "http-status-codes";
import { removePrefixFromPath } from "./utils/remove-prefix-from-path";
import { resolveVersion } from "./utils/resolve-version";

type ExpressRequest = Express.Request;
type ExpressResponse = Express.Response;
type ExpressNextFunction = Express.NextFunction;
type ExpressRouter = Express.Router;
type ExpressRequestHandler = Express.RequestHandler;
type ExpressApp = Express.Application;

export type TypedRequestHandler<TRequest extends ExpressRequest> = (
  request: TRequest,
  response: ExpressResponse,
  next: Express.NextFunction
) => void | Promise<void>;

export type TypedMiddleware<
  TRequestIn extends ExpressRequest,
  TRequestOut extends TRequestIn
> = TypedRequestHandler<TRequestIn>;

export const defineMiddleware =
  <TRequestIn extends ExpressRequest, TRequestOut extends TRequestIn>(
    middlewareFn: TypedRequestHandler<TRequestIn>
  ): TypedMiddleware<TRequestIn, TRequestOut> =>
  (
    request: TRequestIn,
    response: ExpressResponse,
    next: Express.NextFunction
  ) => {
    middlewareFn(request, response, next);
  };

type FormatRootPath<TPath extends string> = TPath extends "" ? "/" : TPath;

type PossiblePaths<
  TRoutes extends AnyRouteDef,
  TMethod extends HTTPMethod
> = Extract<TRoutes, { method: TMethod }>["path"] extends never
  ? "No path found for this method"
  : Extract<TRoutes, { method: TMethod }>["path"];

type InferredPossiblePathsFromPrefix<
  TRoutes extends AnyRouteDef,
  TMethod extends HTTPMethod,
  TRoutePrefix extends string
> = FormatRootPath<
  StringReplaceHead<
    StringStartsWith<PossiblePaths<TRoutes, TMethod>, TRoutePrefix>,
    TRoutePrefix extends "/" ? "" : TRoutePrefix,
    ""
  >
>;

abstract class TypedRouterBase<
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

export class TypedRouterWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string
> extends TypedRouterBase<TRoutes, TRequest, TPath, string[]> {
  public readonly routing: VersionedRouting;

  constructor(routes: RouteHashMap, router: ExpressRouter, path: TPath) {
    super(routes, router, path, []);

    this.routing = new VersionedRouting(
      this,
      Versioning.NO_VERSIONING,
      [],
      new NoVersionExtractor()
    );
  }

  public use<TRequestIn extends TRequest, TRequestOut extends TRequestIn>(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouterWithoutVersioning<TRoutes, TRequestOut, TPath> {
    this.expressRouter.use(handler as ExpressRequestHandler);

    return this as any as TypedRouterWithoutVersioning<
      TRoutes,
      TRequestOut,
      TPath
    >;
  }

  public branch<TPathBranch extends string>(
    path: TPathBranch
  ): TypedRouterWithoutVersioning<
    TRoutes,
    TRequest,
    JoinPath<TPath, TPathBranch>
  > {
    const newRouter = new TypedRouterWithoutVersioning(
      this.routes,
      Express.Router(),
      joinPath(this.path, path)
    ) as TypedRouterWithoutVersioning<
      TRoutes,
      TRequest,
      JoinPath<TPath, TPathBranch>
    >;

    this.expressRouter.use(path, newRouter.expressRouter);

    return newRouter;
  }

  private getRouteHandler<
    TMethod extends HTTPMethod,
    TPathSuffix extends string
  >(method: TMethod, path: TPathSuffix) {
    type TRoute = Extract<
      TRoutes,
      {
        method: TMethod;
        path: WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>;
      }
    >;
    const route = this.routes.get([method, joinPath(this.path, path), ""]);

    if (!route) {
      throw new Error(`Route not found for path: ${joinPath(this.path, path)}`);
    }

    return new TypedRouteHandler<"", TRoute, TPathSuffix, TRequest>(
      "",
      route as TRoute,
      path,
      this
    );
  }

  public get<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "GET", TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler("GET", path);
  }

  public post<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "POST", TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler("POST", path);
  }

  public put<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "PUT", TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler("PUT", path);
  }

  public patch<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "PATCH", TPath>
  >(path: TPathSuffix) {
    return this.getRouteHandler("PATCH", path);
  }

  public delete<
    TPathSuffix extends InferredPossiblePathsFromPrefix<
      TRoutes,
      "DELETE",
      TPath
    >
  >(path: TPathSuffix) {
    return this.getRouteHandler("DELETE", path);
  }
}

export class TypedRouterWithVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string,
  TVersionHistory extends string[]
> extends TypedRouterBase<TRoutes, TRequest, TPath, TVersionHistory> {
  public readonly routing: VersionedRouting;
  protected readonly versioning: VersioningRequired;
  protected readonly versionExtractor: VersionExtractor;

  constructor(
    routes: RouteHashMap,
    router: ExpressRouter,
    path: TPath,
    versioning: VersioningRequired,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor
  ) {
    super(routes, router, path, versionHistory);

    this.versioning = versioning;
    this.versionExtractor = versionExtractor;

    this.routing = new VersionedRouting(
      this,
      versioning,
      versionHistory,
      versionExtractor
    );
  }

  // @todo might be generalized
  public use<TRequestIn extends TRequest, TRequestOut extends TRequestIn>(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouterWithVersioning<TRoutes, TRequestOut, TPath, TVersionHistory> {
    this.expressRouter.use(handler as ExpressRequestHandler);

    return this as any as TypedRouterWithVersioning<
      TRoutes,
      TRequestOut,
      TPath,
      TVersionHistory
    >;
  }

  // @todo might be generalized
  public branch<TPathBranch extends string>(
    path: TPathBranch
  ): TypedRouterWithVersioning<
    TRoutes,
    TRequest,
    JoinPath<TPath, TPathBranch>,
    TVersionHistory
  > {
    const newRouter = new TypedRouterWithVersioning(
      this.routes,
      Express.Router(),
      joinPath(this.path, path),
      this.versioning,
      this.versionHistory,
      this.versionExtractor
    ) as TypedRouterWithVersioning<
      TRoutes,
      TRequest,
      JoinPath<TPath, TPathBranch>,
      TVersionHistory
    >;

    this.expressRouter.use(path, newRouter.expressRouter);

    return newRouter;
  }

  public get<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "GET", TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      TRoutes,
      TRequest,
      TPath,
      TPathSuffix,
      "GET",
      TVersionHistory
    >(this.routes, this.path, path as any, this, "GET"); // @todo resolve any
  }

  public post<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "POST", TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      TRoutes,
      TRequest,
      TPath,
      TPathSuffix,
      "POST",
      TVersionHistory
    >(this.routes, this.path, path as any, this, "POST"); // @todo resolve any
  }

  public put<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "PUT", TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      TRoutes,
      TRequest,
      TPath,
      TPathSuffix,
      "PUT",
      TVersionHistory
    >(this.routes, this.path, path as any, this, "PUT"); // @todo resolve any
  }

  public patch<
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "PATCH", TPath>
  >(path: TPathSuffix) {
    return new VersionSelector<
      TRoutes,
      TRequest,
      TPath,
      TPathSuffix,
      "PATCH",
      TVersionHistory
    >(this.routes, this.path, path as any, this, "PATCH"); // @todo resolve any
  }

  public delete<
    TPathSuffix extends InferredPossiblePathsFromPrefix<
      TRoutes,
      "DELETE",
      TPath
    >
  >(path: TPathSuffix) {
    return new VersionSelector<
      TRoutes,
      TRequest,
      TPath,
      TPathSuffix,
      "DELETE",
      TVersionHistory
    >(this.routes, this.path, path as any, this, "DELETE"); // @todo resolve any
  }
}

type RouteVersions<
  TRoutes extends AnyRouteDef,
  TMethod extends HTTPMethod,
  TPath extends string
> = Extract<TRoutes, { method: TMethod; path: TPath }>["version"];

class VersionSelector<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string,
  TPathSuffix extends string,
  TMethod extends HTTPMethod,
  TVersionHistory extends string[]
> {
  public readonly routes: RouteHashMap;
  private readonly path: TPath;
  private readonly pathSuffix: TPathSuffix;
  private readonly router: TypedRouterBase<
    TRoutes,
    TRequest,
    TPath,
    TVersionHistory
  >;
  private readonly method: TMethod;

  constructor(
    routes: RouteHashMap,
    path: TPath,
    pathSuffix: TPathSuffix,
    router: TypedRouterBase<TRoutes, TRequest, TPath, TVersionHistory>,
    method: TMethod
  ) {
    this.routes = routes;
    this.path = path;
    this.pathSuffix = pathSuffix;
    this.router = router;
    this.method = method;
  }

  private getRouteHandler<TVersion extends string>(version: TVersion) {
    // @todo pick the right route according to the version
    /*type TRoute = Extract<
      TRoutes,
      {
        method: TMethod;
        path: WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>;
      }
    >;*/
    type TRoute = ExtractMatchingRoute<TRoutes, TVersion, TVersionHistory>;
    const route = this.routes.get([
      this.method,
      joinPath(this.path, this.pathSuffix),
      version,
    ]);

    if (!route) {
      throw new Error(
        `Route not found for path ${joinPath(
          this.path,
          this.pathSuffix
        )} and version ${version}`
      );
    }

    return new TypedRouteHandler<TVersion, TRoute, TPathSuffix, TRequest>(
      version,
      route as TRoute,
      this.pathSuffix,
      this.router
    );
  }

  public version<
    TVersion extends RouteVersions<
      TRoutes,
      TMethod,
      WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>
    >
  >(version: TVersion) {
    return this.getRouteHandler(version);
  }
}

type RequestReturnType<TData> =
  | {
      data: TData;
      statusCode?: number;
    }
  | {
      data?: TData;
      customize: (
        response: Express.Response,
        data?: TData
      ) => void | Promise<void>;
      statusCode?: number;
    };

type HandlerReturnType<TRoute extends AnyRouteDef> = RequestReturnType<
  TRoute[ResponseTypeKey]
>;

type RouteValidationOutput<TRoute extends AnyRouteDef> =
  TRoute extends RouteDef<any, any, any, infer TValidator, any>
    ? z.output<TValidator>
    : never;

type TypedRouteHandlerFn<
  TRoute extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TValidationResult
> = (
  request: TRequest,
  validationOutput: TValidationResult
) => HandlerReturnType<TRoute> | Promise<HandlerReturnType<TRoute>>;

class TypedRouteHandler<
  TVersion extends string,
  TRoute extends AnyRouteDef,
  TPathSuffix extends string,
  TRequest extends ExpressRequest
> {
  protected readonly route: TRoute;
  protected readonly path: TPathSuffix;
  protected readonly router: TypedRouterBase<
    AnyRouteDef,
    TRequest,
    string,
    string[]
  >;
  protected readonly middlewares: TypedMiddleware<any, any>[] = [];
  protected readonly version: TVersion;

  constructor(
    version: TVersion,
    route: TRoute,
    path: TPathSuffix,
    router: TypedRouterBase<AnyRouteDef, TRequest, string, string[]>
  ) {
    this.route = route;
    this.path = path;
    this.router = router;
    this.version = version;
  }

  public middleware<
    TRequestIn extends TRequest,
    TRequestOut extends TRequestIn
  >(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouteHandler<TVersion, TRoute, TPathSuffix, TRequestOut> {
    this.middlewares.push(handler);

    return this as any as TypedRouteHandler<
      TVersion,
      TRoute,
      TPathSuffix,
      TRequestOut
    >;
  }

  public handle(
    handler: TypedRouteHandlerFn<
      TRoute,
      TRequest,
      RouteValidationOutput<TRoute>
    >
  ) {
    this.router.routing.addRoute(this.route, handler as any, this.middlewares); // @todo resolve any
  }
}

export interface VersionExtractor {
  extractVersion: (request: ExpressRequest) => string | undefined | null;
}

class NoVersionExtractor implements VersionExtractor {
  extractVersion() {
    return "";
  }
}

type AnyRouteHandlerFn = TypedRouteHandlerFn<AnyRouteDef, ExpressRequest, any>;
type RouteBundle = {
  route: AnyRouteDef;
  handler: AnyRouteHandlerFn;
  middlewares: TypedMiddleware<any, any>[];
};

class VersionedRouting {
  // mapping http method and path to potential multiple route versions
  protected readonly routes: HashMap<[HTTPMethod, string], RouteBundle[]> =
    new HashMap((key) => key.join("-"));
  protected readonly router: TypedRouterBase<any, any, string, string[]>;
  protected readonly versionHistory: string[];
  protected readonly versioning: Versioning;
  protected readonly versionExtractor: VersionExtractor;

  constructor(
    router: TypedRouterBase<any, any, string, string[]>,
    versioning: Versioning,
    versionHistory: string[],
    versionExtractor: VersionExtractor
  ) {
    this.router = router;
    this.versioning = versioning;
    this.versionHistory = versionHistory;
    this.versionExtractor = versionExtractor;
  }

  public addRoute(
    route: AnyRouteDef,
    handler: AnyRouteHandlerFn,
    middlewares: TypedMiddleware<any, any>[]
  ) {
    const key = [route.method, route.path] as [HTTPMethod, string];

    if (this.routes.has(key)) {
      this.routes.get(key)!.push({ route, handler, middlewares });
    } else {
      this.routes.set(key, [{ route, handler, middlewares }]);

      this.initRouting(route);
    }
  }

  private initRouting(route: AnyRouteDef) {
    const moutingPath = removePrefixFromPath(route.path, this.router.fullPath);

    this.router.expressRouter[typedLowerCase(route.method)](
      moutingPath,
      this.getRouteHandler(route.method, route.path)
    );
  }

  private getRouteHandler(method: HTTPMethod, path: string) {
    return async (request: ExpressRequest, response: ExpressResponse) => {
      try {
        const routeToExecute = this.getRouteToExecute(
          method,
          path,
          this.versionExtractor.extractVersion(request) ??
            this.versionHistory.at(-1)
        );

        const { middlewares, handler, route } = routeToExecute;

        // emulate express behavior for executing middlewares
        let i = 0;
        const nextMiddleware = async () => {
          const middleware = middlewares.at(i++);

          if (middleware) {
            await middleware(request, response, nextMiddleware);
          } else {
            const validationOutput = route.validator.parse(request);

            // @todo make requested and resolved version available in request
            const result = await handler(request, validationOutput);

            response.status(result.statusCode || StatusCodes.OK);

            // make sure this is the last action in the handler,
            // since from here on we alredy sent the response and the request is finished
            if ("customize" in result) {
              await result.customize(response, result.data);
            } else {
              response.send(result.data);
            }
          }
        };
        await nextMiddleware();
      } catch (err) {
        const error = err as Error;

        response.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
      }
    };
  }

  protected getRouteToExecute(
    method: HTTPMethod,
    path: string,
    requestedVersion: string | undefined
  ) {
    const key = [method, path] as [HTTPMethod, string];
    const routes = this.routes.get(key);

    if (!routes) {
      throw new Error(`No route handler found for method ${method} ${path}`);
    }

    if (this.versioning === Versioning.NO_VERSIONING) {
      const firstRoute = routes.at(0);

      if (!firstRoute) {
        throw new Error(`No route handler found for method ${method} ${path}`);
      }

      return firstRoute;
    } else {
      if (!requestedVersion) {
        throw new Error("No version specified and no default version found");
      }

      const resolvedVersion = resolveVersion(
        this.versionHistory,
        routes.map(({ route }) => route.version),
        requestedVersion
      );
      //console.log({ requestedVersion, resolvedVersion });

      if (resolvedVersion === null) {
        throw new Error(
          `No compatible route version found for requested version ${requestedVersion}`
        );
      }

      const routeToExecute = routes.find(
        ({ route }) => route.version === resolvedVersion
      );

      if (routeToExecute === undefined) {
        throw new Error(
          `No executable route version found for resolved version ${resolvedVersion}`
        );
      }

      return routeToExecute;
    }
  }
}

// resolves last version of route according to the version history, given the client version
type SearchRoute<
  TRoutes extends AnyRouteDef,
  TVersionClient extends string,
  TVersionHistory extends string[]
> = Extract<TRoutes, { version: TVersionClient }> extends never
  ? TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion]
    ? TCurrentVersion extends string
      ? TOlderVersions extends string[]
        ? SearchRoute<TRoutes, TCurrentVersion, TOlderVersions>
        : never // 'TOlderVersions is not a string array'
      : never // 'TCurrentVersion is not a string'
    : never // 'TVersionHistory is not a string array'
  : Extract<TRoutes, { version: TVersionClient }>;

// recusively search for the correct version position within the version history to start the route search respecting the given client version
type ExtractMatchingRoute<
  TRoutes extends AnyRouteDef,
  TClientVersion extends string,
  TVersionHistory extends string[]
> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion]
  ? TCurrentVersion extends TClientVersion
    ? TOlderVersions extends string[]
      ? SearchRoute<TRoutes, TCurrentVersion, TOlderVersions>
      : never //'TOlderVersions is not a string array #3'
    : TOlderVersions extends string[]
    ? ExtractMatchingRoute<TRoutes, TClientVersion, TOlderVersions>
    : never // 'TOlderVersions is not a string array #2'
  : never; // 'TVersionHistory is not a string array #1'

export abstract class TypedExpressApplication {
  public static withoutVersioning<
    TRoutes extends AnyRouteDef,
    TRequest extends ExpressRequest
  >(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING>
  ) {
    return new TypedExpressApplicationWithoutVersioning<TRoutes, TRequest>(
      expressApp,
      bagOfRoutes
    );
  }

  public static withVersioning<
    TRoutes extends AnyRouteDef,
    TRequest extends ExpressRequest,
    TVersionHistory extends string[]
  >(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired>,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor
  ) {
    return new TypedExpressApplicationWithVersioning<
      TRoutes,
      TRequest,
      TVersionHistory
    >(expressApp, bagOfRoutes, versionHistory, versionExtractor);
  }
}

class TypedExpressApplicationWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest
> extends TypedRouterWithoutVersioning<TRoutes, TRequest, "/"> {
  protected readonly bagOfRoutes: BagOfRoutes<TRoutes, Versioning>;
  constructor(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING>
  ) {
    super(bagOfRoutes.routes, expressApp, "/");

    this.bagOfRoutes = bagOfRoutes;
  }
}

class TypedExpressApplicationWithVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TVersionHistory extends string[]
> extends TypedRouterWithVersioning<TRoutes, TRequest, "/", TVersionHistory> {
  protected readonly bagOfRoutes: BagOfRoutes<TRoutes, Versioning>;

  constructor(
    expressApp: ExpressApp,
    bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired>,
    versionHistory: TVersionHistory,
    versionExtractor: VersionExtractor
  ) {
    super(
      bagOfRoutes.routes,
      expressApp,
      "/",
      bagOfRoutes.versioning,
      versionHistory,
      versionExtractor
    );

    this.bagOfRoutes = bagOfRoutes;
  }
}

type VersioningRequired = Exclude<Versioning, Versioning.NO_VERSIONING>;

// demo

type RequestWithUserId = ExpressRequest & { userId: string };
const authMiddleware = defineMiddleware<ExpressRequest, RequestWithUserId>(
  (request, response, next) => {
    (request as any).userId = "123";
    next();
  }
);

const versionHistory = VersionHistory([
  "2024-01-01",
  "2024-02-01",
  "2024-03-01",
] as const);

class PricenowAPIVersionHeaderExtractor implements VersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header("x-pricenow-api-version");
  }
}

const expressApp = Express.default();
const typedRESTApplication = TypedExpressApplication.withVersioning(
  expressApp,
  demoBagOfRoutes,
  versionHistory,
  new PricenowAPIVersionHeaderExtractor()
)
  .use(
    cors({
      origin: "*",
      preflightContinue: true,
    })
  )
  .use(authMiddleware)
  .use((request, _, next) => {
    console.log(request.userId);

    next();
  });

const basketRouterPublic = typedRESTApplication.branch("/basket");

basketRouterPublic.use((request, response, next) => {
  // still works
  console.log(request.userId);

  next();
});

basketRouterPublic
  .get("/:basketId/entries")
  .version("2024-01-01")
  .middleware((request, _, next) => {
    console.log(request.userId);

    next();
  })
  .handle((request, validationResult) => {
    console.log(request.userId);
    console.log(validationResult.params.basketId);

    return null as any; // @todo
  });

basketRouterPublic
  .get("/")
  .version("2024-01-01")
  .middleware((request, _, next) => {
    console.log(request.userId);
    console.log(request.params.basketId);

    next();
  })
  .handle(async (request, validationResult) => {
    console.log(request.userId);
    console.log(validationResult.params.basketId);

    return {
      statusCode: 201,
      data: { id: "123", entries: [] as any[] },
    };
  });
