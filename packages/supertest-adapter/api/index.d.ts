import { TypedExpressApplicationWithoutVersioning, TypedExpressApplicationWithVersioning, ApplicationRoutes } from '@t-rest/express-server';
import * as _t_rest_core from '@t-rest/core';
import { HTTPMethod, AnyRouteDef, RouteRequestInput, RouteValidationInput, DecodedBody, ResponseMap, ExtractVersionMatchingRoute } from '@t-rest/core';
import { BaseRequestInput, VersionConvention } from '@t-rest/protocol';
import supertest from 'supertest';

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
/** The text a scalar arrives as. */
type FieldText<TValue> = TValue extends number | bigint | boolean ? `${TValue}` : TValue extends null ? '' : string;
type MultipartFieldMember<TMember, TField> = TMember extends undefined ? undefined : TMember extends string ? TMember : TMember extends readonly (infer TItem)[] ? undefined extends TField ? readonly MultipartFieldValue<TItem>[] : readonly [MultipartFieldValue<TItem>, ...MultipartFieldValue<TItem>[]] : TMember extends number | bigint | boolean | null | Date ? FieldText<TMember> extends TField ? TMember : never : TMember extends object ? {
    [TKey in keyof TMember]: MultipartFieldValue<TMember[TKey]>;
} : never;
/**
 * A value the validator accepts once it arrived as a form field: arrays and
 * objects are flattened into bracketed names, everything else arrives as text.
 * A number, boolean, date or `null` is only accepted where the validator also
 * takes its text, e.g. through `z.coerce.number()`.
 */
type MultipartFieldValue<TField> = unknown extends TField ? unknown : MultipartFieldMember<TField, TField>;
type MultipartFields<TBody> = unknown extends TBody ? Record<string, unknown> : TBody extends object ? {
    [TKey in keyof TBody]: MultipartFieldValue<TBody[TKey]>;
} : never;
type RequiredKeys<T> = {
    [TKey in keyof T]-?: {} extends Pick<T, TKey> ? never : TKey;
}[keyof T];
/**
 * Multer leaves `file` out without an upload, and `files` of `.fields()` empty.
 * The `files` array of `.array()` and `.any()` may be empty.
 */
type RequiresFile<TInput> = 'file' extends RequiredKeys<TInput> ? true : 'files' extends RequiredKeys<TInput> ? TInput extends {
    files: infer TFiles;
} ? TFiles extends readonly unknown[] ? false : {} extends TFiles ? false : true : false : false;
type MultipartFieldsInput<TInput> = TInput extends {
    body: infer TBody;
} ? {
    fields: MultipartFields<TBody>;
} : 'body' extends keyof TInput ? {
    fields?: MultipartFields<TInput['body']>;
} : {
    fields?: Record<string, unknown>;
};
type MultipartFilesInput<TInput> = RequiresFile<TInput> extends true ? {
    files: [MultipartFile, ...MultipartFile[]];
} : {
    files?: MultipartFile[];
};
/**
 * The text fields are what the validator of the route gets as `body`. Routes
 * validating no body still accept untyped fields. A route requiring a file
 * requires one in `files`.
 */
type MultipartInput<TInput> = MultipartFieldsInput<TInput> & MultipartFilesInput<TInput>;

type BaseRequestInputWithoutBody = Omit<BaseRequestInput, 'body'>;
interface InvalidBodyRequestInput extends BaseRequestInputWithoutBody {
    body?: unknown;
    multipart?: undefined;
}
interface InvalidMultipartRequestInput extends BaseRequestInputWithoutBody {
    body?: undefined;
    multipart: MultipartBody;
}
/**
 * The input of a request that is meant to fail validation: `params`, `query`
 * and `body` are not tied to the validator of the route and may be left out.
 * A form can be sent as untyped `multipart` instead of a `body`, but not on
 * GET and DELETE, which send no body.
 */
type InvalidRequestInput<TMethod extends HTTPMethod = HTTPMethod> = InvalidBodyRequestInput | (TMethod extends 'GET' | 'DELETE' ? never : InvalidMultipartRequestInput);

type SupertestConfig = {
    headers?: Record<string, string>;
    expect?: {
        headers?: Record<string, RegExp>;
        status?: number;
    };
};

type RequestInput<TRoute extends AnyRouteDef> = RouteRequestInput<TRoute, {
    multipart: MultipartInput<RouteValidationInput<TRoute>>;
}>;

type AnyTypedExpressApplication = TypedExpressApplicationWithoutVersioning<any, any, any> | TypedExpressApplicationWithVersioning<any, any, any, any>;

type ResponseOfStatus<TBody, TStatus extends number> = Omit<supertest.Response, 'body' | 'status' | 'statusCode'> & {
    body: TBody;
    status: TStatus;
    statusCode: TStatus;
};
/** Any response of any route, e.g. for helpers which handle every route. */
type AnySupertestResponse = ResponseOfStatus<any, number>;
/**
 * Discriminated union of the responses a route declares, by `status`. Unknown
 * responses (`unknown`, `any` or `ResponseMap`) are `AnySupertestResponse`.
 */
type SupertestResponse<TResponses> = unknown extends TResponses ? AnySupertestResponse : number extends keyof TResponses ? AnySupertestResponse : TResponses extends unknown ? {
    [TStatus in keyof TResponses & number]: ResponseOfStatus<DecodedBody<TResponses[TStatus], Buffer, Record<string, never>>, TStatus>;
}[keyof TResponses & number] : never;

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
    private resolveRoute?;
    /**
     * The history and the date parsing the server resolves versions with,
     * unversioned applications have neither.
     */
    protected versionResolution(): {
        versionHistory: readonly string[];
        parseDate?: (version: string) => Date;
    };
    /**
     * The responses of the route the server executes for the request: the route
     * declared for the version, else the newest route of an older version.
     */
    protected responsesOf(method: HTTPMethod, path: string, version: string): ResponseMap;
    protected executeRequest<TRequestInput, TResponses>(method: HTTPMethod, path: string, responses: ResponseMap, context: SupertestConfig & TRequestInput & BaseRequestInput & {
        multipart?: MultipartBody;
    }): Promise<SupertestResponse<TResponses>>;
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
    }>["~responses"]>>;
    protected makeInvalidRouteHandler<TMethod extends HTTPMethod>(method: TMethod): <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
    }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidRequestInput<TMethod>) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
        path: TAbsolutePath;
    }>["~responses"]>>;
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
    }>["~responses"]>>;
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
    }>["~responses"]>>;
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
    }>["~responses"]>>;
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
    }>["~responses"]>>;
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
    }>["~responses"]>>;
    /**
     * Same routes, but `params`, `query` and `body` are not checked against the
     * validator of the route, to test how the server rejects invalid input.
     */
    invalid: {
        get: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "GET";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "GET";
            path: TAbsolutePath;
        }>["~responses"]>>;
        post: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "POST";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidRequestInput<"POST">) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "POST";
            path: TAbsolutePath;
        }>["~responses"]>>;
        put: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PUT";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidRequestInput<"PUT">) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "PUT";
            path: TAbsolutePath;
        }>["~responses"]>>;
        patch: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PATCH";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidRequestInput<"PATCH">) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "PATCH";
            path: TAbsolutePath;
        }>["~responses"]>>;
        delete: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "DELETE";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "DELETE";
            path: TAbsolutePath;
        }>["~responses"]>>;
    };
    /**
     * The handlers of `invalid` under a name for valid requests whose wire
     * format the validator does not describe, e.g. because a middleware
     * reshapes the body before validation.
     */
    untyped: {
        get: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "GET";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "GET";
            path: TAbsolutePath;
        }>["~responses"]>>;
        post: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "POST";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidRequestInput<"POST">) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "POST";
            path: TAbsolutePath;
        }>["~responses"]>>;
        put: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PUT";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidRequestInput<"PUT">) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "PUT";
            path: TAbsolutePath;
        }>["~responses"]>>;
        patch: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PATCH";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidRequestInput<"PATCH">) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "PATCH";
            path: TAbsolutePath;
        }>["~responses"]>>;
        delete: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "DELETE";
        }>["path"]>(path: TAbsolutePath, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<Extract<ApplicationRoutes<TApp>, {
            method: "DELETE";
            path: TAbsolutePath;
        }>["~responses"]>>;
    };
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
    protected versionResolution(): {
        versionHistory: string[];
        parseDate: ((version: string) => Date) | undefined;
    };
    protected makeRouteHandler<TMethod extends HTTPMethod>(method: TMethod): <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
    }>["path"], TVersion extends CallableVersions<TApp, TMethod, TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & RequestInput<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>>) => Promise<SupertestResponse<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>["~responses"]>>;
    protected makeInvalidRouteHandler<TMethod extends HTTPMethod>(method: TMethod): <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: TMethod;
    }>["path"], TVersion extends CallableVersions<TApp, TMethod, TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidRequestInput<TMethod>) => Promise<SupertestResponse<AppRouteAt<TApp, TMethod, TAbsolutePath, TVersion>["~responses"]>>;
    private executeVersionedRequest;
    get: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "GET";
    }>["path"], TVersion extends CallableVersions<TApp, "GET", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>["~responses"]>>;
    post: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "POST";
    }>["path"], TVersion extends CallableVersions<TApp, "POST", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>["~responses"]>>;
    put: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "PUT";
    }>["path"], TVersion extends CallableVersions<TApp, "PUT", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>["~responses"]>>;
    patch: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "PATCH";
    }>["path"], TVersion extends CallableVersions<TApp, "PATCH", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>["~responses"]>>;
    delete: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
        method: "DELETE";
    }>["path"], TVersion extends CallableVersions<TApp, "DELETE", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & _t_rest_core.RouteRequestInput<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>, {
        multipart: MultipartInput<_t_rest_core.RouteValidationInput<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>>>;
    }>) => Promise<SupertestResponse<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>["~responses"]>>;
    /**
     * Same routes, but `params`, `query` and `body` are not checked against the
     * validator of the route, to test how the server rejects invalid input.
     */
    invalid: {
        get: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "GET";
        }>["path"], TVersion extends CallableVersions<TApp, "GET", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>["~responses"]>>;
        post: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "POST";
        }>["path"], TVersion extends CallableVersions<TApp, "POST", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidRequestInput<"POST">) => Promise<SupertestResponse<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>["~responses"]>>;
        put: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PUT";
        }>["path"], TVersion extends CallableVersions<TApp, "PUT", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidRequestInput<"PUT">) => Promise<SupertestResponse<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>["~responses"]>>;
        patch: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PATCH";
        }>["path"], TVersion extends CallableVersions<TApp, "PATCH", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidRequestInput<"PATCH">) => Promise<SupertestResponse<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>["~responses"]>>;
        delete: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "DELETE";
        }>["path"], TVersion extends CallableVersions<TApp, "DELETE", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>["~responses"]>>;
    };
    /**
     * The handlers of `invalid` under a name for valid requests whose wire
     * format the validator does not describe, e.g. because a middleware
     * reshapes the body before validation.
     */
    untyped: {
        get: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "GET";
        }>["path"], TVersion extends CallableVersions<TApp, "GET", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<AppRouteAt<TApp, "GET", TAbsolutePath, TVersion>["~responses"]>>;
        post: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "POST";
        }>["path"], TVersion extends CallableVersions<TApp, "POST", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidRequestInput<"POST">) => Promise<SupertestResponse<AppRouteAt<TApp, "POST", TAbsolutePath, TVersion>["~responses"]>>;
        put: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PUT";
        }>["path"], TVersion extends CallableVersions<TApp, "PUT", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidRequestInput<"PUT">) => Promise<SupertestResponse<AppRouteAt<TApp, "PUT", TAbsolutePath, TVersion>["~responses"]>>;
        patch: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "PATCH";
        }>["path"], TVersion extends CallableVersions<TApp, "PATCH", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidRequestInput<"PATCH">) => Promise<SupertestResponse<AppRouteAt<TApp, "PATCH", TAbsolutePath, TVersion>["~responses"]>>;
        delete: <TAbsolutePath extends Extract<ApplicationRoutes<TApp>, {
            method: "DELETE";
        }>["path"], TVersion extends CallableVersions<TApp, "DELETE", TAbsolutePath>>(path: TAbsolutePath, version: TVersion, context: SupertestConfig & InvalidBodyRequestInput) => Promise<SupertestResponse<AppRouteAt<TApp, "DELETE", TAbsolutePath, TVersion>["~responses"]>>;
    };
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
export type { AnySupertestResponse, AnyTypedExpressApplication, DefaultSupertestAdapterConfig, InvalidBodyRequestInput, InvalidMultipartRequestInput, InvalidRequestInput, MultipartBody, MultipartFieldValue, MultipartFields, MultipartFile, MultipartInput, RequestInput, SupertestConfig, SupertestResponse };
