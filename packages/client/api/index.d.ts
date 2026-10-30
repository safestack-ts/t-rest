import { AxiosRequestConfig, AxiosInstance } from 'axios';
import * as _t_rest_core from '@t-rest/core';
import { HTTPMethod, AnyRouteDef, BagOfRoutes, Versioning, ExtractLatestMatchingRoutePerPath, NewerVersions, VersioningRequired, RouteRequestInput } from '@t-rest/core';
import { BaseRequestInput, VersionConvention } from '@t-rest/protocol';

type RequestConfig = {
    headers?: Record<string, string | number | boolean>;
};

type HTTPResponse<TResponse> = {
    data: TResponse;
    statusCode: number;
};

interface HTTPAdapter<TRequestContext = {}> {
    /**
     * `data` is a `FormData` for routes declared with `.multipart()`. It has to
     * be sent as is: the transport sets the content type with its boundary.
     */
    request<TResponse>(method: HTTPMethod, url: string, data: unknown, requestConfig?: RequestConfig & TRequestContext): Promise<HTTPResponse<TResponse>>;
}

declare class AxiosHTTPAdapter implements HTTPAdapter<AxiosRequestConfig> {
    private readonly axiosInstance;
    constructor(axiosInstance: AxiosInstance);
    request<TResponse>(method: HTTPMethod, url: string, data: unknown, requestConfig?: RequestConfig & AxiosRequestConfig): Promise<{
        data: TResponse;
        statusCode: number;
    }>;
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
    protected request<TMethod extends HTTPMethod, TResponse, TRequestConfig extends BaseRequestInput & RequestConfig & TRequestContext>(method: TMethod, path: string, requestConfig?: TRequestConfig): Promise<HTTPResponse<TResponse>>;
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
    }>, TVersion, TVersionHistory>["~responseType"]>>;
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
    }>, TVersion, TVersionHistory>["~responseType"]>>;
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
    }>, TVersion, TVersionHistory>["~responseType"]>>;
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
    }>, TVersion, TVersionHistory>["~responseType"]>>;
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
    }>, TVersion, TVersionHistory>["~responseType"]>>;
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
    }>["~responseType"]>>;
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
    }>["~responseType"]>>;
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
    }>["~responseType"]>>;
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
    }>["~responseType"]>>;
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
    }>["~responseType"]>>;
}

declare abstract class RESTClient<TRoutes extends AnyRouteDef, TVersionHistory extends string[], TRequestContext> extends RESTClientBase<TRoutes, TVersionHistory, TRequestContext> {
    static withoutVersioning<TRoutes extends AnyRouteDef, TRequestContext>(bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>, httpAdapter: HTTPAdapter<TRequestContext>): RESTClientWithoutVersioning<TRoutes, TRequestContext>;
    static withVersioning<TRoutes extends AnyRouteDef, TVersionHistory extends string[], TVersion extends TVersionHistory[number], TRequestContext>(bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>, version: TVersion, httpAdapter: HTTPAdapter<TRequestContext>, versionInjectorConstructor: VersionInjectorConstructor): RESTClientWithVersioning<TRoutes, TVersion, TVersionHistory, TRequestContext>;
}

type RequestInput<TRoute extends AnyRouteDef> = RouteRequestInput<TRoute, {
    body: FormData;
}>;

declare const versionInjectorFrom: (convention: VersionConvention) => VersionInjectorConstructor;

export { AxiosHTTPAdapter, NoVersionInjector, RESTClient, RESTClientWithVersioning, RESTClientWithoutVersioning, VersionInjector, versionInjectorFrom };
export type { HTTPAdapter, HTTPResponse, RequestArgs, RequestConfig, RequestInput, VersionInjectorConstructor };
