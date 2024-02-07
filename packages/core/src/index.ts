import { z } from "zod";
import { HashMap } from "./hash-map";
import { VersionHistory } from "./version-history";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; // @todo add remaining types

export type RouteHashMap = HashMap<[HTTPMethod, string, string], AnyRouteDef>; // HTTPMethod, Path, Version

const responseType = Symbol("Response Type");
export type ResponseTypeKey = typeof responseType;

export class RouteDef<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator extends z.ZodTypeAny,
  TResponse
> {
  public readonly version: TVersion;
  public readonly method: TMethod;
  public readonly path: TPath;
  public readonly validator: TValidator;
  public readonly [responseType]: TResponse;

  constructor(
    version: TVersion,
    method: TMethod,
    path: TPath,
    validator: TValidator
  ) {
    this.version = version;
    this.method = method;
    this.path = path;
    this.validator = validator;
    this[responseType] = null as any;
  }
}

export class Route {
  public version<TVersion extends string>(version: TVersion) {
    return new RouteWithVersion(version);
  }

  public get<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath("", "GET", path);
  }

  public post<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath("", "POST", path);
  }

  public put<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath("", "PUT", path);
  }

  public patch<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath("", "PATCH", path);
  }

  public delete<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath("", "DELETE", path);
  }
}

export class RouteWithVersion<TVersion extends string> {
  constructor(private version: TVersion) {}

  public get<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      "GET",
      path
    );
  }

  public post<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      "POST",
      path
    );
  }

  public put<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      "PUT",
      path
    );
  }

  public patch<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      "PATCH",
      path
    );
  }

  public delete<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      "DELETE",
      path
    );
  }
}

export class RouteBuilderWithVersionAndMethodAndPath<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath
  ) {}

  public validate<TValidator extends z.ZodTypeAny>(validator: TValidator) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidator<
      TVersion,
      TMethod,
      TPath,
      TValidator
    >(this.version, this.method, this.path, validator);
  }

  public response<TResponse>() {
    return new RouteDef<TVersion, TMethod, TPath, z.ZodTypeAny, TResponse>(
      this.version,
      this.method,
      this.path,
      z.any()
    );
  }
}

export class RouteBuilderWithVersionAndMethodAndPathAndValidator<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator extends z.ZodTypeAny
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private validator: TValidator
  ) {}

  public response<TResponse>() {
    return new RouteDef<TVersion, TMethod, TPath, TValidator, TResponse>(
      this.version,
      this.method,
      this.path,
      this.validator
    );
  }
}

export type AnyRouteDef = RouteDef<
  string,
  HTTPMethod,
  string,
  z.ZodTypeAny,
  any
>;

export enum Versioning {
  NO_VERSIONING,
  DATE,
  SEMVER,
}

export class BagOfRoutesBuilderWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersioning extends Versioning,
  TVersionHistory extends string[]
> {
  protected routes: RouteHashMap = new HashMap<
    [HTTPMethod, string, string],
    AnyRouteDef
  >((key) => key.join("-"));
  private versioning: TVersioning;

  constructor(versioning: TVersioning) {
    this.versioning = versioning;
  }

  public addRoute<
    TVersion extends TVersionHistory[number],
    TRouteDef extends RouteDef<TVersion, HTTPMethod, string, any, any>
  >(
    route: TRouteDef
  ): BagOfRoutesBuilderWithVersioning<
    TRoutes | TRouteDef,
    TVersioning,
    TVersionHistory
  > {
    this.routes.set([route.method, route.path, route.version], route);
    return this;
  }

  public build() {
    return new BagOfRoutes<TRoutes, TVersioning>(this.routes, this.versioning);
  }
}

export class BagOfRoutes<
  TRoutes extends AnyRouteDef,
  TVersioning extends Versioning
> {
  public readonly routes: RouteHashMap;
  public readonly versioning: TVersioning;

  constructor(routes: RouteHashMap, versioning: TVersioning) {
    this.routes = routes;
    this.versioning = versioning;
  }

  // @todo make version history passable and infer available version for route definitions from it
  public static withVersioning<
    TVersioning extends Versioning,
    TVersionHistory extends string[]
  >(versioning: TVersioning, versionHistory: TVersionHistory) {
    return new BagOfRoutesBuilderWithVersioning<
      never,
      TVersioning,
      TVersionHistory
    >(versioning);
  }

  public static withoutVersioning() {
    return new BagOfRoutesBuilderWithVersioning<
      never,
      Versioning.NO_VERSIONING,
      string[]
    >(Versioning.NO_VERSIONING);
  }
}

const versionHistory = VersionHistory([
  "2024-01-01",
  "2024-02-01",
  "2024-03-01",
] as const);

export const demoBagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    new Route()
      .version("2024-01-01")
      .get("/basket")
      .response<{ id: string; entries: any[] }>()
  )
  .addRoute(
    new Route()
      .version("2024-01-01")
      .get("/basket/:basketId/entries")
      .validate(z.object({ params: z.object({ basketId: z.string() }) }))
      .response<any[]>()
  )
  .build();

export * from "./path";
export * from "./hash-map";
export * from "./typed-string-case";
export * from "./string-types";
export * from "./zod-extensions";
export * from "./remove-readonly";
export * from "./version-history";
