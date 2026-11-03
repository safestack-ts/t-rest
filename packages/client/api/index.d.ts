import * as _t_rest_core from '@t-rest/core';
import { AnyRouteDef, BagOfRoutes, Versioning, HTTPMethod, ResponseMap, ExtractLatestMatchingRoutePerPath, NewerVersions, VersioningRequired, RouteRequestInput, AnyResponseDescriptor } from '@t-rest/core';
import { H as HTTPAdapter, R as RequestConfig, b as HTTPResponse } from './http-adapter.js';
export { A as AnyHTTPResponse, c as HTTPResponseHeaders, a as RequestBodyEncoding } from './http-adapter.js';
import { BaseRequestInput, VersionConvention } from '@t-rest/protocol';

declare abstract class VersionInjector {
    protected readonly version: string;
    constructor(version: string);
    modifyUrl(url: string): string;
    modifyHeaders(headers: Record<string, string | number | boolean>): Record<string, string | number | boolean>;
}
declare class NoVersionInjector extends VersionInjector {
    constructor(_version: string);
}
type VersionInjectorConstructor = new (version: string) => VersionInjector;

declare abstract class RESTClientBase<TRoutes extends AnyRouteDef, TVersionHistory extends string[], TRequestContext> {
    protected readonly routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>;
    protected readonly httpAdapter: HTTPAdapter<TRequestContext>;
    protected readonly versionInjector: VersionInjector;
    private readonly resolveRoute;
    constructor(routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>, httpAdapter: HTTPAdapter<TRequestContext>, versionInjector: VersionInjector);
    private routeOf;
    protected requestedVersion(): string;
    private bodyEncodingOf;
    protected request<TMethod extends HTTPMethod, TResponses extends ResponseMap, TRequestConfig extends BaseRequestInput & RequestConfig & TRequestContext>(method: TMethod, path: string, requestConfig?: TRequestConfig): Promise<HTTPResponse<TResponses>>;
}

type RequestArgs<TRequestInput, TPath extends string, TRequestContext> = {} extends TRequestInput ? [
    path: TPath,
    requestConfig?: RequestConfig & TRequestInput & TRequestContext
] : [
    path: TPath,
    requestConfig: RequestConfig & TRequestInput & TRequestContext
];

declare class RESTClientWithVersioning<TRoutes extends AnyRouteDef, TVersion extends TRoutes['version'], TVersionHistory extends string[], TRequestContext> extends RESTClientBase<TRoutes, TVersionHistory, TRequestContext> {
    protected readonly version: TVersion;
    protected readonly versionInjectorConstructor: VersionInjectorConstructor;
    constructor(routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>, version: TVersion, httpAdapter: HTTPAdapter<TRequestContext>, versionInjectorConstructor: VersionInjectorConstructor);
    protected requestedVersion(): TVersion;
    private makeRouteHandler;
    get: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "GET";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    post: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "POST";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    put: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PUT";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    patch: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PATCH";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    delete: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "DELETE";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "DELETE";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "DELETE";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    withVersion<TNewVersion extends NewerVersions<TVersionHistory, TVersion>>(version: TNewVersion): RESTClientWithVersioning<TRoutes, TNewVersion, TVersionHistory, TRequestContext>;
}

declare class RESTClientWithoutVersioning<TRoutes extends AnyRouteDef, TRequestContext> extends RESTClientBase<TRoutes, never, TRequestContext> {
    constructor(routes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>, httpAdapter: HTTPAdapter<TRequestContext>);
    private makeRouteHandler;
    get: <TAbsolutePath extends Extract<TRoutes, {
        method: "GET";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>["~responses"]>>;
    post: <TAbsolutePath extends Extract<TRoutes, {
        method: "POST";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>["~responses"]>>;
    put: <TAbsolutePath extends Extract<TRoutes, {
        method: "PUT";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>["~responses"]>>;
    patch: <TAbsolutePath extends Extract<TRoutes, {
        method: "PATCH";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>["~responses"]>>;
    delete: <TAbsolutePath extends Extract<TRoutes, {
        method: "DELETE";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteRequestInput<Extract<TRoutes, {
        method: "DELETE";
        path: TAbsolutePath;
    }>, {
        body: FormData;
    }>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "DELETE";
        path: TAbsolutePath;
    }>["~responses"]>>;
}

declare abstract class RESTClient<TRoutes extends AnyRouteDef, TVersionHistory extends string[], TRequestContext> extends RESTClientBase<TRoutes, TVersionHistory, TRequestContext> {
    static withoutVersioning<TRoutes extends AnyRouteDef, TRequestContext>(bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>, httpAdapter: HTTPAdapter<TRequestContext>): RESTClientWithoutVersioning<TRoutes, TRequestContext>;
    static withVersioning<TRoutes extends AnyRouteDef, TVersionHistory extends string[], TVersion extends TVersionHistory[number], TRequestContext>(bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>, version: TVersion, httpAdapter: HTTPAdapter<TRequestContext>, versionInjectorConstructor: VersionInjectorConstructor): RESTClientWithVersioning<TRoutes, TVersion, TVersionHistory, TRequestContext>;
}

type RequestInput<TRoute extends AnyRouteDef> = RouteRequestInput<TRoute, {
    body: FormData;
}>;

declare const versionInjectorFrom: (convention: VersionConvention) => VersionInjectorConstructor;

/**
 * Whether the route declares the status. An `HTTPAdapter` resolves declared
 * statuses and rejects all others.
 */
declare const isDeclaredStatus: (responses: ResponseMap, status: number) => boolean;
/**
 * Decodes the raw body of a response by the descriptor of its status: json is
 * parsed, an empty json body is `undefined`, text is a string, binary an
 * `ArrayBuffer` and empty is `undefined`. Without a descriptor the body is
 * returned as is.
 *
 * Throws a `SyntaxError` for a json body which is not valid json.
 *
 * @example
 * const response = await fetch(url)
 * if (!isDeclaredStatus(responses, response.status)) {
 *   throw new Error(`Request failed with status code ${response.status}`)
 * }
 * const data = decodeBody(
 *   await response.arrayBuffer(),
 *   responses[response.status]
 * )
 */
declare const decodeBody: (body: string | ArrayBuffer | ArrayBufferView, descriptor: AnyResponseDescriptor | undefined) => unknown;

export { HTTPAdapter, HTTPResponse, NoVersionInjector, RESTClient, RESTClientWithVersioning, RESTClientWithoutVersioning, RequestConfig, VersionInjector, decodeBody, isDeclaredStatus, versionInjectorFrom };
export type { RequestArgs, RequestInput, VersionInjectorConstructor };
