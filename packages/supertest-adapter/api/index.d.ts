import { TypedExpressApplicationWithoutVersioning, TypedExpressApplicationWithVersioning, ApplicationRoutes } from '@t-rest/express-server';
import * as _t_rest_core from '@t-rest/core';
import { AnyRouteDef, RouteRequestInput, RouteValidationInput, HTTPMethod, ExtractVersionMatchingRoute } from '@t-rest/core';
import { BaseRequestInput, VersionConvention } from '@t-rest/protocol';
import supertest from 'supertest';

type SupertestConfig = {
    headers?: Record<string, string>;
    expect?: {
        headers?: Record<string, RegExp>;
        status?: number;
    };
};

type MultipartFileSource = {
    buffer: Buffer;
    path?: undefined;
    filename: string;
} | {
    path: string;
    buffer?: undefined;
    filename?: string;
};
type MultipartFile = MultipartFileSource & {
    field: string;
    contentType?: string;
};
type MultipartBody<TFields = Record<string, unknown>> = {
    fields?: TFields;
    files?: MultipartFile[];
};
/**
 * The text fields are what the validator of the route gets as `body`. Routes
 * validating no body still accept untyped fields.
 */
type MultipartInput<TInput> = TInput extends {
    body: infer TFields;
} ? MultipartBody<TFields> & {
    fields: TFields;
} : 'body' extends keyof TInput ? MultipartBody<TInput['body']> : MultipartBody;

type RequestInput<TRoute extends AnyRouteDef> = RouteRequestInput<TRoute, {
    multipart: MultipartInput<RouteValidationInput<TRoute>>;
}>;

type AnyTypedExpressApplication = TypedExpressApplicationWithoutVersioning<any, any, any> | TypedExpressApplicationWithVersioning<any, any, any, any>;

type SupertestResponse<TBody = undefined> = Omit<supertest.Response, 'body'> & {
    body: TBody;
};

type DefaultSupertestAdapterConfig = {
    headers?: Record<string, string>;
    /**
     * Root express application (or http server) the requests are sent to.
     * Required if the typed application is built on an express router: the
     * router alone misses the middlewares and the mount path of its parent
     * application. Defaults to the express application of the typed application.
     */
    expressApp?: Parameters<typeof supertest>[0];
};

declare abstract class SupertestAdapterBase<TApp extends AnyTypedExpressApplication> {
    protected app: TApp;
    protected defaultConfig: DefaultSupertestAdapterConfig;
    private readonly requestTarget;
    constructor(app: TApp, defaultConfig: DefaultSupertestAdapterConfig);
    protected executeRequest<TRequestInput, TResponseType>(method: HTTPMethod, path: string, context: SupertestConfig & TRequestInput & BaseRequestInput & {
        multipart?: MultipartBody;
    }): Promise<SupertestResponse<TResponseType>>;
    private attachMultipart;
    private stringifyBody;
}

declare class SupertestAdapterWithoutVersioning<TApp extends TypedExpressApplicationWithoutVersioning<any, any, any>> extends SupertestAdapterBase<TApp> {
    protected makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod): <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
    }>["path"]>(path: TAbsolutePath, context: SupertestConfig & RequestInput<Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
        path: TAbsolutePath;
    }>>) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
        path: TAbsolutePath;
    }>["~responseType"]>>;
    get: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "GET";
    }>["path"]>(path: TAbsolutePath, context: SupertestConfig & _t_rest_core.RouteRequestInput<Extract<ApplicationRoutes<TApp>, {
        method: "GET";
        path: TAbsolutePath;
    }>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<Extract<ApplicationRoutes<TApp>, {
            method: "GET";
            path: TAbsolutePath;
        }>>>;
    }>) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
        method: "GET";
        path: TAbsolutePath;
    }>["~responseType"]>>;
    post: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "POST";
    }>["path"]>(path: TAbsolutePath, context: SupertestConfig & _t_rest_core.RouteRequestInput<Extract<ApplicationRoutes<TApp>, {
        method: "POST";
        path: TAbsolutePath;
    }>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<Extract<ApplicationRoutes<TApp>, {
            method: "POST";
            path: TAbsolutePath;
        }>>>;
    }>) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
        method: "POST";
        path: TAbsolutePath;
    }>["~responseType"]>>;
    put: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "PUT";
    }>["path"]>(path: TAbsolutePath, context: SupertestConfig & _t_rest_core.RouteRequestInput<Extract<ApplicationRoutes<TApp>, {
        method: "PUT";
        path: TAbsolutePath;
    }>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<Extract<ApplicationRoutes<TApp>, {
            method: "PUT";
            path: TAbsolutePath;
        }>>>;
    }>) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
        method: "PUT";
        path: TAbsolutePath;
    }>["~responseType"]>>;
    patch: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "PATCH";
    }>["path"]>(path: TAbsolutePath, context: SupertestConfig & _t_rest_core.RouteRequestInput<Extract<ApplicationRoutes<TApp>, {
        method: "PATCH";
        path: TAbsolutePath;
    }>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<Extract<ApplicationRoutes<TApp>, {
            method: "PATCH";
            path: TAbsolutePath;
        }>>>;
    }>) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
        method: "PATCH";
        path: TAbsolutePath;
    }>["~responseType"]>>;
    delete: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "DELETE";
    }>["path"]>(path: TAbsolutePath, context: SupertestConfig & _t_rest_core.RouteRequestInput<Extract<ApplicationRoutes<TApp>, {
        method: "DELETE";
        path: TAbsolutePath;
    }>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<Extract<ApplicationRoutes<TApp>, {
            method: "DELETE";
            path: TAbsolutePath;
        }>>>;
    }>) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
        method: "DELETE";
        path: TAbsolutePath;
    }>["~responseType"]>>;
}

declare abstract class SupertestVersionInjector {
    modifyUrl(url: string, _version: string): string;
    modifyHeaders(headers: Record<string, string | number | boolean>, _version: string): Record<string, string | number | boolean>;
}
/** @deprecated Renamed to `SupertestVersionInjector`, the client has a `VersionInjector` of its own. */
declare const VersionInjector: typeof SupertestVersionInjector;
/** @deprecated Renamed to `SupertestVersionInjector`, the client has a `VersionInjector` of its own. */
type VersionInjector = SupertestVersionInjector;

type AppVersionHistory<TApp> = TApp extends TypedExpressApplicationWithVersioning<any, any, any, infer THistory> ? THistory extends string[] ? THistory : never : never;
type AppRoutesFor<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>, TMethod extends HTTPMethod, TPath extends string> = Extract<ApplicationRoutes<TApp>, {
    method: TMethod;
    path: TPath;
}>;
type CharsOf<TValue extends string, TChars extends string = never> = TValue extends `${infer TChar}${infer TRest}` ? CharsOf<TRest, TChars | TChar> : TChars;
type WordChar = CharsOf<'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'>;
type DropParamName<TRest extends string> = TRest extends `${infer TChar}${infer TTail}` ? TChar extends WordChar ? DropParamName<TTail> : TRest : '';
type PathShape<TPath extends string> = TPath extends `${infer THead}:${infer TRest}` ? TRest extends `${WordChar}${string}` ? `${THead}%s${PathShape<DropParamName<TRest>>}` : `${THead}:${PathShape<TRest>}` : TPath;
type AppRoutesOfShape<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>, TMethod extends HTTPMethod, TPath extends string> = Extract<ApplicationRoutes<TApp>, {
    method: TMethod;
}> extends infer TRoute ? TRoute extends {
    path: string;
} ? PathShape<TRoute['path']> extends PathShape<TPath> ? TRoute : never : never : never;
type ResolvedRoute<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>, TMethod extends HTTPMethod, TPath extends string, TVersion extends string> = ExtractVersionMatchingRoute<AppRoutesOfShape<TApp, TMethod, TPath>, TVersion, AppVersionHistory<TApp>>;
type ResolvableVersions<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>, TMethod extends HTTPMethod, TPath extends string> = {
    [TVersion in AppVersionHistory<TApp>[number]]: [
        ResolvedRoute<TApp, TMethod, TPath, TVersion>
    ] extends [never] ? never : ResolvedRoute<TApp, TMethod, TPath, TVersion> extends {
        path: TPath;
    } ? TVersion : never;
}[AppVersionHistory<TApp>[number]];
/**
 * The versions a request to the route may be sent with: the declared versions
 * of the route and the later versions of the history, which the server
 * resolves down to a declared version.
 *
 * The declared versions are part of the union explicitly, so that a version
 * history which is not a tuple (a plain `string[]`) keeps them callable.
 */
type CallableVersions<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>, TMethod extends HTTPMethod, TPath extends string> = AppRoutesFor<TApp, TMethod, TPath>['version'] | ResolvableVersions<TApp, TMethod, TPath>;
/**
 * The route the server executes for the version of a request: the route
 * declared for exactly this version, else the newest route of an older version.
 * A union of versions yields the routes of all its members.
 */
type AppRouteAt<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>, TMethod extends HTTPMethod, TPath extends string, TVersion extends string> = TVersion extends string ? [
    Extract<AppRoutesFor<TApp, TMethod, TPath>, {
        version: TVersion;
    }>
] extends [never] ? ResolvedRoute<TApp, TMethod, TPath, TVersion> : Extract<AppRoutesFor<TApp, TMethod, TPath>, {
    version: TVersion;
}> : never;

declare class SupertestAdapterWithVersioning<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>> extends SupertestAdapterBase<TApp> {
    private readonly versionInjector;
    constructor(app: TApp, versionInjector: SupertestVersionInjector, defaultConfig: DefaultSupertestAdapterConfig);
    protected makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod): <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
    }>["path"], TVersion extends CallableVersions<TApp, TMethod, TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & RequestInput<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>>) => Promise<SupertestResponse<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>["~responseType"]>>;
    get: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "GET";
    }>["path"], TVersion extends CallableVersions<TApp, "GET", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>["~responseType"]>>;
    post: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "POST";
    }>["path"], TVersion extends CallableVersions<TApp, "POST", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>["~responseType"]>>;
    put: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "PUT";
    }>["path"], TVersion extends CallableVersions<TApp, "PUT", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>["~responseType"]>>;
    patch: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "PATCH";
    }>["path"], TVersion extends CallableVersions<TApp, "PATCH", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>["~responseType"]>>;
    delete: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "DELETE";
    }>["path"], TVersion extends CallableVersions<TApp, "DELETE", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>["~responseType"]>>;
}

declare abstract class SupertestAdapter {
    static withoutVersioning<TApp extends TypedExpressApplicationWithoutVersioning<any, any, any>>(app: TApp, defaultConfig?: DefaultSupertestAdapterConfig): SupertestAdapterWithoutVersioning<TApp>;
    static withVersioning<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>>(app: TApp, versionInjector: SupertestVersionInjector, defaultConfig?: DefaultSupertestAdapterConfig): SupertestAdapterWithVersioning<TApp>;
}

declare class SupertestTargetError extends Error {
    constructor(message: string);
    static isSupertestTargetError(error: unknown): error is SupertestTargetError;
    static [Symbol.hasInstance](instance: unknown): boolean;
}

declare const versionInjectorFrom: (convention: VersionConvention) => SupertestVersionInjector;

export { SupertestAdapter, SupertestAdapterWithVersioning, SupertestAdapterWithoutVersioning, SupertestTargetError, SupertestVersionInjector, VersionInjector, versionInjectorFrom };
export type { AnyTypedExpressApplication, DefaultSupertestAdapterConfig, MultipartBody, MultipartFile, MultipartInput, RequestInput, SupertestConfig, SupertestResponse };
