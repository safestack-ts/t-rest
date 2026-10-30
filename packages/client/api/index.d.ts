import { AxiosRequestConfig, AxiosInstance } from 'axios';
import * as _t_rest_core from '@t-rest/core';
import { JsonResponseDescriptor, TextResponseDescriptor, BinaryResponseDescriptor, EmptyResponseDescriptor, ResponseMap, HTTPMethod, AnyRouteDef, BagOfRoutes, Versioning, ExtractLatestMatchingRoutePerPath, NewerVersions, VersioningRequired, RouteValidationInput } from '@t-rest/core';
import { BaseRequestInput, VersionConvention } from '@t-rest/protocol';

type RequestConfig = {
    headers?: Record<string, string | number | boolean>;
};

type ResponseData<TDescriptor> = TDescriptor extends JsonResponseDescriptor<infer TBody> ? TBody : TDescriptor extends TextResponseDescriptor<string> ? string : TDescriptor extends BinaryResponseDescriptor ? ArrayBuffer : TDescriptor extends EmptyResponseDescriptor ? undefined : never;
/** Discriminated union of the responses a route declares, by `statusCode`. */
type HTTPResponse<TResponses> = TResponses extends unknown ? {
    [TStatus in keyof TResponses & number]: {
        data: ResponseData<TResponses[TStatus]>;
        statusCode: TStatus;
    };
}[keyof TResponses & number] : never;

interface HTTPAdapter<TRequestContext = {}> {
    /**
     * Resolves for the statuses declared in `responses` and rejects for all
     * others. `responses` holds the descriptors of the route of the request.
     */
    request<TResponses extends ResponseMap>(method: HTTPMethod, url: string, data: unknown, responses: TResponses, requestConfig?: RequestConfig & TRequestContext): Promise<HTTPResponse<TResponses>>;
}

declare class AxiosHTTPAdapter implements HTTPAdapter<AxiosRequestConfig> {
    private readonly axiosInstance;
    constructor(axiosInstance: AxiosInstance);
    request<TResponses extends ResponseMap>(method: HTTPMethod, url: string, data: unknown, responses: TResponses, requestConfig?: RequestConfig & AxiosRequestConfig): Promise<HTTPResponse<TResponses>>;
}

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
    constructor(routes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>, httpAdapter: HTTPAdapter<TRequestContext>, versionInjector: VersionInjector);
    private routeOf;
    protected routeVersion(_method: HTTPMethod, _path: string): string;
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
    protected routeVersion(method: HTTPMethod, path: string): string;
    private makeRouteHandler;
    get: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "GET";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    post: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "POST";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    put: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PUT";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    patch: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PATCH";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>["~responses"]>>;
    delete: <TAbsolutePath extends ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "DELETE";
    }>, TVersion, TVersionHistory>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
        method: "DELETE";
        path: TAbsolutePath;
    }>, TVersion, TVersionHistory>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<ExtractLatestMatchingRoutePerPath<Extract<TRoutes, {
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
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "GET";
        path: TAbsolutePath;
    }>["~responses"]>>;
    post: <TAbsolutePath extends Extract<TRoutes, {
        method: "POST";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "POST";
        path: TAbsolutePath;
    }>["~responses"]>>;
    put: <TAbsolutePath extends Extract<TRoutes, {
        method: "PUT";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "PUT";
        path: TAbsolutePath;
    }>["~responses"]>>;
    patch: <TAbsolutePath extends Extract<TRoutes, {
        method: "PATCH";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "PATCH";
        path: TAbsolutePath;
    }>["~responses"]>>;
    delete: <TAbsolutePath extends Extract<TRoutes, {
        method: "DELETE";
    }>["path"]>(...args: RequestArgs<_t_rest_core.RouteValidationInput<Extract<TRoutes, {
        method: "DELETE";
        path: TAbsolutePath;
    }>>, TAbsolutePath, TRequestContext>) => Promise<HTTPResponse<Extract<TRoutes, {
        method: "DELETE";
        path: TAbsolutePath;
    }>["~responses"]>>;
}

declare abstract class RESTClient<TRoutes extends AnyRouteDef, TVersionHistory extends string[], TRequestContext> extends RESTClientBase<TRoutes, TVersionHistory, TRequestContext> {
    static withoutVersioning<TRoutes extends AnyRouteDef, TRequestContext>(bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>, httpAdapter: HTTPAdapter<TRequestContext>): RESTClientWithoutVersioning<TRoutes, TRequestContext>;
    static withVersioning<TRoutes extends AnyRouteDef, TVersionHistory extends string[], TVersion extends TVersionHistory[number], TRequestContext>(bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>, version: TVersion, httpAdapter: HTTPAdapter<TRequestContext>, versionInjectorConstructor: VersionInjectorConstructor): RESTClientWithVersioning<TRoutes, TVersion, TVersionHistory, TRequestContext>;
}

type RequestInput<TRoute extends AnyRouteDef> = RouteValidationInput<TRoute>;

declare const versionInjectorFrom: (convention: VersionConvention) => VersionInjectorConstructor;

export { AxiosHTTPAdapter, NoVersionInjector, RESTClient, RESTClientWithVersioning, RESTClientWithoutVersioning, VersionInjector, versionInjectorFrom };
export type { HTTPAdapter, HTTPResponse, RequestArgs, RequestConfig, RequestInput, VersionInjectorConstructor };
