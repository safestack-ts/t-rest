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

type ExpressRequest = Express.Request;
type ExpressResponse = Express.Response;
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
  TPath extends string
> {
  public readonly routes: RouteHashMap;
  public readonly expressRouter: ExpressRouter;
  protected readonly path: TPath;
  public readonly routing: VersionedRouting;

  constructor(routes: RouteHashMap, router: ExpressRouter, path: TPath) {
    this.routes = routes;
    this.expressRouter = router;
    this.path = path;

    this.routing = new VersionedRouting(this);
  }

  public get fullPath() {
    return this.path;
  }
}

export class TypedRouterWithoutVersioning<
  TRoutes extends AnyRouteDef,
  TRequest extends ExpressRequest,
  TPath extends string
> extends TypedRouterBase<TRoutes, TRequest, TPath> {
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
  TPath extends string
> extends TypedRouterBase<TRoutes, TRequest, TPath> {
  protected readonly versioning: VersioningRequired;

  constructor(
    routes: RouteHashMap,
    router: ExpressRouter,
    path: TPath,
    versioning: VersioningRequired
  ) {
    super(routes, router, path);

    this.versioning = versioning;
  }

  // @todo might be generalized
  public use<TRequestIn extends TRequest, TRequestOut extends TRequestIn>(
    handler: TypedMiddleware<TRequestIn, TRequestOut>
  ): TypedRouterWithVersioning<TRoutes, TRequestOut, TPath> {
    this.expressRouter.use(handler as ExpressRequestHandler);

    return this as any as TypedRouterWithVersioning<
      TRoutes,
      TRequestOut,
      TPath
    >;
  }

  // @todo might be generalized
  public branch<TPathBranch extends string>(
    path: TPathBranch
  ): TypedRouterWithVersioning<
    TRoutes,
    TRequest,
    JoinPath<TPath, TPathBranch>
  > {
    const newRouter = new TypedRouterWithVersioning(
      this.routes,
      Express.Router(),
      joinPath(this.path, path),
      this.versioning
    ) as TypedRouterWithVersioning<
      TRoutes,
      TRequest,
      JoinPath<TPath, TPathBranch>
    >;

    this.expressRouter.use(path, newRouter.expressRouter);

    return newRouter;
  }

  private getRouteHandler<
    TVersion extends string,
    TMethod extends HTTPMethod,
    TPathSuffix extends string
  >(version: TVersion, method: TMethod, path: TPathSuffix) {
    // @todo pick the right route according to the version
    type TRoute = Extract<
      TRoutes,
      {
        method: TMethod;
        path: WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>;
      }
    >;
    const route = this.routes.get([method, joinPath(this.path, path), version]);

    if (!route) {
      throw new Error(
        `Route not found for path ${joinPath(
          this.path,
          path
        )} and version ${version}`
      );
    }

    return new TypedRouteHandler<TVersion, TRoute, TPathSuffix, TRequest>(
      version,
      route as TRoute,
      path,
      this
    );
  }

  public get<
    TVersion extends string,
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "GET", TPath>
  >(version: TVersion, path: TPathSuffix) {
    return this.getRouteHandler(version, "GET", path);
  }

  public post<
    TVersion extends string,
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "POST", TPath>
  >(version: TVersion, path: TPathSuffix) {
    return this.getRouteHandler(version, "POST", path);
  }

  public put<
    TVersion extends string,
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "PUT", TPath>
  >(version: TVersion, path: TPathSuffix) {
    return this.getRouteHandler(version, "PUT", path);
  }

  public patch<
    TVersion extends string,
    TPathSuffix extends InferredPossiblePathsFromPrefix<TRoutes, "PATCH", TPath>
  >(version: TVersion, path: TPathSuffix) {
    return this.getRouteHandler(version, "PATCH", path);
  }

  public delete<
    TVersion extends string,
    TPathSuffix extends InferredPossiblePathsFromPrefix<
      TRoutes,
      "DELETE",
      TPath
    >
  >(version: TVersion, path: TPathSuffix) {
    return this.getRouteHandler(version, "DELETE", path);
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
  protected readonly router: TypedRouterBase<AnyRouteDef, TRequest, string>;
  protected readonly middlewares: TypedMiddleware<any, any>[] = [];
  protected readonly version: TVersion;

  constructor(
    version: TVersion,
    route: TRoute,
    path: TPathSuffix,
    router: TypedRouterBase<AnyRouteDef, TRequest, string>
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

type AnyRouteHandlerFn = TypedRouteHandlerFn<AnyRouteDef, ExpressRequest, any>;

class VersionedRouting {
  // mapping http method and path to potential multiple route versions
  protected readonly routes: HashMap<
    [HTTPMethod, string],
    {
      route: AnyRouteDef;
      handler: AnyRouteHandlerFn;
      middlewares: TypedMiddleware<any, any>[];
    }[]
  > = new HashMap((key) => key.join("-"));
  // @todo use new TypedRouterBase type here
  protected readonly router: TypedRouterBase<any, any, string>;

  constructor(router: TypedRouterBase<any, any, string>) {
    this.router = router;
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

      this.initRouting(route, handler, middlewares);
    }
  }

  private initRouting(
    route: AnyRouteDef,
    handler: AnyRouteHandlerFn,
    middlewares: TypedMiddleware<any, any>[]
  ) {
    const moutingPath = removePrefixFromPath(route.path, this.router.fullPath);

    this.router.expressRouter[typedLowerCase(route.method)](
      moutingPath,
      ...middlewares,
      async (request, response) => {
        // @todo add version handling
        const validationOutput = route.validator.parse(request);

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
    );
  }
}

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
}

export class TypedExpressApplicationWithoutVersioning<
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

type VersioningRequired = Exclude<Versioning, Versioning.NO_VERSIONING>;

// demo

/*type RequestWithUserId = ExpressRequest & { userId: string };
const authMiddleware = defineMiddleware<ExpressRequest, RequestWithUserId>(
  (request, response, next) => {
    (request as any).userId = "123";
    next();
  }
);

const expressApp = Express.default();
const typedRESTApplication = TypedExpressApplication.withoutVersioning(
  expressApp,
  demoBagOfRoutes
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
  });*/
