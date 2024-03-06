import {
  AnyRouteDef,
  BagOfRoutes,
  Versioning,
  VersioningRequired,
  demoBagOfRoutes,
} from "@typed-rest/core";

export abstract class RESTClient<TRoutes extends AnyRouteDef> {
  protected readonly routes: BagOfRoutes<TRoutes, Versioning>;

  constructor(routes: BagOfRoutes<TRoutes, Versioning>) {
    this.routes = routes;
  }

  public static withoutVersioning<TRoutes extends AnyRouteDef>(
    bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING>
  ) {
    return new RESTClientWithoutVersioning(bagOfRoutes);
  }

  public static withVersioning<
    TRoutes extends AnyRouteDef,
    TVersion extends TRoutes["version"]
  >(bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired>, version: TVersion) {
    return new RESTClientWithVersioning(bagOfRoutes, version);
  }
}

export class RESTClientWithoutVersioning<
  TRoutes extends AnyRouteDef
> extends RESTClient<TRoutes> {
  public get<TAbsolutePath extends Extract<TRoutes, { method: "GET" }>["path"]>(
    path: TAbsolutePath
  ) {}
}

export class RESTClientWithVersioning<
  TRoutes extends AnyRouteDef,
  TVersion extends TRoutes["version"]
> extends RESTClient<TRoutes> {
  protected readonly version: TVersion;

  constructor(routes: BagOfRoutes<TRoutes, Versioning>, version: TVersion) {
    super(routes);
    this.version = version;
  }
}

// Playground
const client = RESTClient.withVersioning(demoBagOfRoutes, "2024-01-01");
