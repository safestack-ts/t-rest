import { HTTPMethod, DeclaredStatus, JsonResponseDescriptor, TextResponseDescriptor, BinaryResponseDescriptor, EmptyResponseDescriptor, ResponseDescriptorOf, AnyRouteDef, Versioning, RouteHashMap, StringReplaceHead, StringStartsWith, WithoutDoubleSlash, WithoutTrailingSlash, JoinPath, RouteValidationOutput, ExtractVersionMatchingRoute, VersioningRequired, BagOfRoutes, PrefixMatchingRoutes } from '@t-rest/core';
import * as Express from 'express';
import { VersionConvention } from '@t-rest/protocol';

type ExpressRequest = Express.Request;
type ExpressResponse<TBody = any> = Express.Response<TBody>;
type ExpressNextFunction = Express.NextFunction;
type ExpressRouter = Express.Router;
type ExpressRequestHandler = Express.RequestHandler;
type ExpressApp = Express.Application;

interface VersionExtractor {
    extractVersion: (request: ExpressRequest) => string | undefined | null;
}

type Resolution = {
    readonly kind: 'unversioned';
} | {
    readonly kind: 'resolved';
    readonly requested: string;
    readonly resolved: string;
} | {
    readonly kind: 'missing';
} | {
    readonly kind: 'incompatible';
    readonly requested: string;
};

declare class VersionRegistry {
    private readonly versions;
    private readonly resolutions;
    register(method: HTTPMethod, path: string, version: string): boolean;
    handledVersions(key: string): readonly string[];
    resolve(request: ExpressRequest, key: string, resolve: () => Resolution): Resolution;
    static keyOf(method: HTTPMethod, path: string): string;
}

type AnyTypedRoute = {
    '~responses': unknown;
};
type JsonBodyMethods<TBody> = {
    json(body: TBody): void;
};
type TextBodyMethods = {
    send(body: string): void;
};
type BinaryBodyMethods = {
    send(body: Uint8Array): void;
    stream(body: NodeJS.ReadableStream): void;
    file(path: string): void;
};
type EmptyBodyMethods = {
    end(): void;
};
type BodyMethods<TDescriptor> = TDescriptor extends JsonResponseDescriptor<infer TBody> ? JsonBodyMethods<TBody> : TDescriptor extends TextResponseDescriptor<string> ? TextBodyMethods : TDescriptor extends BinaryResponseDescriptor ? BinaryBodyMethods : TDescriptor extends EmptyResponseDescriptor ? EmptyBodyMethods : never;
type TypedStatusResponse<TRoute extends AnyTypedRoute, TStatus extends number> = BodyMethods<ResponseDescriptorOf<TRoute, TStatus>>;
/**
 * The response passed to route handlers, its body methods are typed by the
 * responses the route declares. `raw` is the native response of the framework.
 */
interface TypedResponseBase<TRoute extends AnyTypedRoute> {
    status<TStatus extends DeclaredStatus<TRoute>>(code: TStatus): TypedStatusResponse<TRoute, TStatus>;
    header(name: string, value: string): this;
    raw: ExpressResponse;
}
type TypedResponse<TRoute extends AnyTypedRoute> = TypedResponseBase<TRoute> & (200 extends DeclaredStatus<TRoute> ? ResponseDescriptorOf<TRoute, 200> extends JsonResponseDescriptor<infer TBody> ? JsonBodyMethods<TBody> : {} : {});

type TypedRouteHandlerFn<TRoute extends AnyRouteDef, TRequest extends ExpressRequest, TValidationResult> = (request: TRequest, validationOutput: TValidationResult, response: TypedResponse<TRoute>) => void | Promise<void>;

type AnyRouteHandlerFn = TypedRouteHandlerFn<AnyRouteDef, ExpressRequest, unknown>;

type TypedRequestHandler<TRequest extends ExpressRequest> = (request: TRequest, response: ExpressResponse, next: ExpressNextFunction) => unknown;

type TypedMiddleware<TRequestIn extends ExpressRequest, _TRequestOut> = TypedRequestHandler<TRequestIn>;

declare class VersionedRouting {
    protected readonly router: TypedRouterBase<any, any, string, string[]>;
    protected readonly versionHistory: string[];
    protected readonly versioning: Versioning;
    protected readonly versionExtractor: VersionExtractor;
    protected readonly versionRegistry: VersionRegistry;
    private readonly policy;
    constructor(router: TypedRouterBase<any, any, string, string[]>, versioning: Versioning, versionHistory: string[], versionExtractor: VersionExtractor, versionRegistry?: VersionRegistry);
    addRoute(route: AnyRouteDef, handler: AnyRouteHandlerFn, middlewares: TypedMiddleware<any, any>[]): void;
    private getRouteHandler;
}

declare abstract class TypedRouterBase<_TRoutes extends AnyRouteDef, _TRequest extends ExpressRequest, TPath extends string, TVersionHistory extends string[]> {
    readonly routes: RouteHashMap;
    readonly expressRouter: ExpressRouter;
    protected readonly path: TPath;
    abstract readonly routing: VersionedRouting;
    protected readonly versionHistory: TVersionHistory;
    constructor(routes: RouteHashMap, router: ExpressRouter, path: TPath, versionHistory: TVersionHistory);
    get fullPath(): TPath;
}

type FormatRootPath<TPath extends string> = TPath extends '' ? '/' : TPath;
type PossiblePaths<TRoutes extends AnyRouteDef, TMethod extends HTTPMethod> = Extract<TRoutes, {
    method: TMethod;
}>['path'] extends never ? 'No path found for this method' : Extract<TRoutes, {
    method: TMethod;
}>['path'];
type PossiblePathsFromPrefix<TRoutes extends AnyRouteDef, TMethod extends HTTPMethod, TRoutePrefix extends string> = FormatRootPath<StringReplaceHead<StringStartsWith<PossiblePaths<TRoutes, TMethod>, TRoutePrefix>, TRoutePrefix extends '/' ? '' : TRoutePrefix, ''>>;

type RouterRoute<TRoutes extends AnyRouteDef, TMethod extends HTTPMethod, TPath extends string, TPathSuffix extends string> = Extract<TRoutes, {
    method: TMethod;
    path: WithoutDoubleSlash<WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>>;
}>;

declare class TypedRouteHandler<TVersion extends string, TRoute extends AnyRouteDef, TPathSuffix extends string, TRequest extends ExpressRequest> {
    protected readonly route: TRoute;
    protected readonly path: TPathSuffix;
    protected readonly router: TypedRouterBase<AnyRouteDef, TRequest, string, string[]>;
    protected readonly middlewares: TypedMiddleware<any, any>[];
    protected readonly version: TVersion;
    constructor(version: TVersion, route: TRoute, path: TPathSuffix, router: TypedRouterBase<AnyRouteDef, TRequest, string, string[]>);
    middleware<TRequestIn extends TRequest, TRequestOut extends TRequestIn>(handler: TypedMiddleware<TRequestIn, TRequestOut>): TypedRouteHandler<TVersion, TRoute, TPathSuffix, TRequestOut>;
    handle(handler: TypedRouteHandlerFn<TRoute, TRequest, RouteValidationOutput<TRoute>>): void;
}

type RequestVersion = {
    version: {
        requested: string;
        resolved: string;
    };
};

type RouteVersions<TRoutes extends AnyRouteDef, TMethod extends HTTPMethod, TPath extends string> = Extract<TRoutes, {
    method: TMethod;
    path: TPath;
}>['version'];

declare class VersionSelector<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TPath extends string, TPathSuffix extends string, TMethod extends HTTPMethod, TVersionHistory extends string[]> {
    readonly routes: RouteHashMap;
    private readonly path;
    private readonly pathSuffix;
    private readonly router;
    private readonly method;
    constructor(routes: RouteHashMap, path: TPath, pathSuffix: TPathSuffix, router: TypedRouterBase<TRoutes, TRequest, TPath, TVersionHistory>, method: TMethod);
    private getRouteHandler;
    version<TVersion extends RouteVersions<TRoutes, TMethod, WithoutDoubleSlash<WithoutTrailingSlash<JoinPath<TPath, TPathSuffix>>>>>(version: TVersion): TypedRouteHandler<TVersion, ExtractVersionMatchingRoute<TRoutes, TVersion, TVersionHistory>, TPathSuffix, TRequest & RequestVersion>;
}

declare class TypedRouterWithVersioning<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TPath extends string, TVersionHistory extends string[]> extends TypedRouterBase<TRoutes, TRequest, TPath, TVersionHistory> {
    readonly routing: VersionedRouting;
    protected readonly versioning: VersioningRequired;
    protected readonly versionExtractor: VersionExtractor;
    protected readonly versionRegistry: VersionRegistry;
    constructor(routes: RouteHashMap, router: ExpressRouter, path: TPath, versioning: VersioningRequired, versionHistory: TVersionHistory, versionExtractor: VersionExtractor, versionRegistry?: VersionRegistry);
    use<TRequestIn extends TRequest, TRequestOut>(handler: TypedMiddleware<TRequestIn, TRequestOut>): TypedRouterWithVersioning<TRoutes, TRequest & TRequestOut, TPath, TVersionHistory>;
    branch<TPathBranch extends string>(path: TPathBranch): TypedRouterWithVersioning<TRoutes, TRequest, JoinPath<TPath, TPathBranch>, TVersionHistory>;
    mount<TModuleRoutes extends TRoutes, TModuleContext extends ExpressRequest>(routerModule: TRequest extends TModuleContext ? TypedRouterModuleWithVersioning<TModuleRoutes, TPath, TModuleContext, TVersionHistory> : never): this;
    private select;
    get<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'GET', TPath>>(path: TPathSuffix): VersionSelector<RouterRoute<TRoutes, 'GET', TPath, TPathSuffix>, TRequest, TPath, TPathSuffix, 'GET', TVersionHistory>;
    post<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'POST', TPath>>(path: TPathSuffix): VersionSelector<RouterRoute<TRoutes, 'POST', TPath, TPathSuffix>, TRequest, TPath, TPathSuffix, 'POST', TVersionHistory>;
    put<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PUT', TPath>>(path: TPathSuffix): VersionSelector<RouterRoute<TRoutes, 'PUT', TPath, TPathSuffix>, TRequest, TPath, TPathSuffix, 'PUT', TVersionHistory>;
    patch<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PATCH', TPath>>(path: TPathSuffix): VersionSelector<RouterRoute<TRoutes, 'PATCH', TPath, TPathSuffix>, TRequest, TPath, TPathSuffix, 'PATCH', TVersionHistory>;
    delete<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'DELETE', TPath>>(path: TPathSuffix): VersionSelector<RouterRoute<TRoutes, 'DELETE', TPath, TPathSuffix>, TRequest, TPath, TPathSuffix, 'DELETE', TVersionHistory>;
}

type TypedRouterModuleWithoutVersioning<TRoutes extends AnyRouteDef, TPath extends string, TContext extends ExpressRequest> = {
    readonly type: 'withoutVersioning';
    readonly path: TPath;
    configure(router: TypedRouterWithoutVersioning<TRoutes, TContext, TPath>): void;
};
type TypedRouterModuleWithVersioning<TRoutes extends AnyRouteDef, TPath extends string, TContext extends ExpressRequest, TVersionHistory extends string[]> = {
    readonly type: 'withVersioning';
    readonly path: TPath;
    configure(router: TypedRouterWithVersioning<TRoutes, TContext, TPath, TVersionHistory>): void;
};

declare class TypedRouterWithoutVersioning<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TPath extends string> extends TypedRouterBase<TRoutes, TRequest, TPath, string[]> {
    readonly routing: VersionedRouting;
    protected readonly versionRegistry: VersionRegistry;
    constructor(routes: RouteHashMap, router: ExpressRouter, path: TPath, versionRegistry?: VersionRegistry);
    use<TRequestIn extends TRequest, TRequestOut>(handler: TypedMiddleware<TRequestIn, TRequestOut>): TypedRouterWithoutVersioning<TRoutes, TRequest & TRequestOut, TPath>;
    branch<TPathBranch extends string>(path: TPathBranch): TypedRouterWithoutVersioning<TRoutes, TRequest, JoinPath<TPath, TPathBranch>>;
    mount<TModuleRoutes extends TRoutes, TModuleContext extends ExpressRequest>(routerModule: TRequest extends TModuleContext ? TypedRouterModuleWithoutVersioning<TModuleRoutes, TPath, TModuleContext> : never): this;
    private getRouteHandler;
    get<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'GET', TPath>>(path: TPathSuffix): TypedRouteHandler<'', RouterRoute<TRoutes, 'GET', TPath, TPathSuffix>, TPathSuffix, TRequest>;
    post<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'POST', TPath>>(path: TPathSuffix): TypedRouteHandler<'', RouterRoute<TRoutes, 'POST', TPath, TPathSuffix>, TPathSuffix, TRequest>;
    put<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PUT', TPath>>(path: TPathSuffix): TypedRouteHandler<'', RouterRoute<TRoutes, 'PUT', TPath, TPathSuffix>, TPathSuffix, TRequest>;
    patch<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'PATCH', TPath>>(path: TPathSuffix): TypedRouteHandler<'', RouterRoute<TRoutes, 'PATCH', TPath, TPathSuffix>, TPathSuffix, TRequest>;
    delete<TPathSuffix extends PossiblePathsFromPrefix<TRoutes, 'DELETE', TPath>>(path: TPathSuffix): TypedRouteHandler<'', RouterRoute<TRoutes, 'DELETE', TPath, TPathSuffix>, TPathSuffix, TRequest>;
}

declare class TypedExpressApplicationWithoutVersioning<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TMountPath extends string> extends TypedRouterWithoutVersioning<TRoutes, TRequest, TMountPath> {
    readonly expressApp: ExpressApp | ExpressRouter;
    protected readonly bagOfRoutes: BagOfRoutes<TRoutes, Versioning, never>;
    constructor(expressApp: ExpressApp | ExpressRouter, bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>, mountPath: TMountPath);
}

declare class TypedExpressApplicationWithVersioning<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TMountPath extends string, TVersionHistory extends string[]> extends TypedRouterWithVersioning<TRoutes, TRequest, TMountPath, TVersionHistory> {
    readonly expressApp: ExpressApp | ExpressRouter;
    protected readonly bagOfRoutes: BagOfRoutes<TRoutes, Versioning, TVersionHistory>;
    constructor(expressApp: ExpressApp | ExpressRouter, bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>, versionHistory: TVersionHistory, versionExtractor: VersionExtractor, mountPath: TMountPath);
}

declare abstract class TypedExpressApplication {
    static withoutVersioning<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TMountPath extends string = '/'>(expressApp: ExpressApp | ExpressRouter, bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>, mountPath?: TMountPath): TypedExpressApplicationWithoutVersioning<TRoutes, TRequest, TMountPath>;
    static withVersioning<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TVersionHistory extends string[], TMountPath extends string = '/'>(expressApp: ExpressApp | ExpressRouter, bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>, versionExtractor: VersionExtractor, mountPath?: TMountPath): TypedExpressApplicationWithVersioning<TRoutes, TRequest, TMountPath, TVersionHistory>;
    /**
     * @deprecated The version history is taken from the bag of routes, omit the
     * `versionHistory` argument.
     */
    static withVersioning<TRoutes extends AnyRouteDef, TRequest extends ExpressRequest, TVersionHistory extends string[], TMountPath extends string = '/'>(expressApp: ExpressApp | ExpressRouter, bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>, versionHistory: TVersionHistory, versionExtractor: VersionExtractor, mountPath?: TMountPath): TypedExpressApplicationWithVersioning<TRoutes, TRequest, TMountPath, TVersionHistory>;
}

declare class RouteSetupError extends Error {
    constructor(message: string);
    static isRouteSetupError(error: unknown): error is RouteSetupError;
    static [Symbol.hasInstance](instance: unknown): boolean;
}

declare class VersionResolutionError extends Error {
    readonly status = 400;
    readonly statusCode = 400;
    constructor(message: string);
    static isVersionResolutionError(error: unknown): error is VersionResolutionError;
    static [Symbol.hasInstance](instance: unknown): boolean;
}

interface DateVersionExtractor extends VersionExtractor {
    parseDate: (version: string) => Date;
}

type BranchedRouter<TAppOrRouter extends TypedRouterBase<any, any, any, any>, TBranchPath extends string, TRequestContext = {}> = TAppOrRouter extends TypedRouterWithoutVersioning<infer TRoutes, infer TRequest, infer TRouterPrefix> ? TypedRouterWithoutVersioning<PrefixMatchingRoutes<TRoutes, JoinPath<TRouterPrefix, TBranchPath>>, TRequest & TRequestContext, JoinPath<TRouterPrefix, TBranchPath>> : TAppOrRouter extends TypedRouterWithVersioning<infer TRoutes, infer TRequest, infer TRouterPrefix, infer TVersionHistory> ? TypedRouterWithVersioning<PrefixMatchingRoutes<TRoutes, JoinPath<TRouterPrefix, TBranchPath>>, TRequest & TRequestContext, JoinPath<TRouterPrefix, TBranchPath>, TVersionHistory> : never;

type ApplicationRoutes<TApp extends TypedExpressApplicationWithVersioning<any, any, any, any> | TypedExpressApplicationWithoutVersioning<any, any, any>> = TApp extends TypedExpressApplicationWithVersioning<infer TRoutes, any, any, any> ? TRoutes : TApp extends TypedExpressApplicationWithoutVersioning<infer TRoutes, any, any> ? TRoutes : never;

declare const createTypedResponse: <TRoute extends AnyRouteDef>(res: ExpressResponse, route: TRoute, next: ExpressNextFunction) => TypedResponse<TRoute>;

declare const defineMiddleware: <TRequestIn extends ExpressRequest, TRequestOut>(middlewareFn: TypedRequestHandler<TRequestIn>) => TypedMiddleware<TRequestIn, TRequestOut>;

type ContextRequest<TContext> = ExpressRequest & TContext;
type MatchingPath<TRoutes extends AnyRouteDef, TPath extends string> = PrefixMatchingRoutes<TRoutes, TPath> extends never ? never : TPath;
declare class RouterModuleBuilderWithoutVersioning<TRoutes extends AnyRouteDef, TPath extends string, TContext> {
    private readonly path;
    constructor(path: TPath);
    withContext<TNextContext>(): RouterModuleBuilderWithoutVersioning<TRoutes, TPath, TNextContext>;
    configure(configureRouter: (router: TypedRouterWithoutVersioning<PrefixMatchingRoutes<TRoutes, TPath>, ContextRequest<TContext>, TPath>) => void): TypedRouterModuleWithoutVersioning<PrefixMatchingRoutes<TRoutes, TPath>, TPath, ContextRequest<TContext>>;
}
declare class RouterModuleBuilderWithVersioning<TRoutes extends AnyRouteDef, TPath extends string, TContext, TVersionHistory extends string[]> {
    private readonly path;
    constructor(path: TPath);
    withContext<TNextContext>(): RouterModuleBuilderWithVersioning<TRoutes, TPath, TNextContext, TVersionHistory>;
    configure(configureRouter: (router: TypedRouterWithVersioning<PrefixMatchingRoutes<TRoutes, TPath>, ContextRequest<TContext>, TPath, TVersionHistory>) => void): TypedRouterModuleWithVersioning<PrefixMatchingRoutes<TRoutes, TPath>, TPath, ContextRequest<TContext>, TVersionHistory>;
}
declare class DefineRouterModuleWithoutVersioning<TRoutes extends AnyRouteDef> {
    at<TPath extends `/${string}`>(path: MatchingPath<TRoutes, TPath>): RouterModuleBuilderWithoutVersioning<TRoutes, TPath, unknown>;
}
declare class DefineRouterModuleWithVersioning<TRoutes extends AnyRouteDef, TVersionHistory extends string[]> {
    at<TPath extends `/${string}`>(path: MatchingPath<TRoutes, TPath>): RouterModuleBuilderWithVersioning<TRoutes, TPath, unknown, TVersionHistory>;
}
declare function defineRouterModule<TRoutes extends AnyRouteDef>(_bagOfRoutes: BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>): DefineRouterModuleWithoutVersioning<TRoutes>;
declare function defineRouterModule<TRoutes extends AnyRouteDef, TVersionHistory extends string[]>(_bagOfRoutes: BagOfRoutes<TRoutes, VersioningRequired, TVersionHistory>): DefineRouterModuleWithVersioning<TRoutes, TVersionHistory>;

declare function versionExtractorFrom(convention: VersionConvention, options?: {
    parseDate?: undefined;
}): VersionExtractor;
declare function versionExtractorFrom(convention: VersionConvention, options: {
    parseDate: (version: string) => Date;
}): DateVersionExtractor;

export { RouteSetupError, TypedExpressApplication, TypedExpressApplicationWithVersioning, TypedExpressApplicationWithoutVersioning, TypedRouterWithVersioning, TypedRouterWithoutVersioning, VersionResolutionError, createTypedResponse, defineMiddleware, defineRouterModule, versionExtractorFrom };
export type { ApplicationRoutes, BranchedRouter, DateVersionExtractor, ExpressApp, ExpressNextFunction, ExpressRequest, ExpressRequestHandler, ExpressResponse, ExpressRouter, RequestVersion, TypedMiddleware, TypedRequestHandler, TypedResponse, TypedResponseBase, TypedRouteHandlerFn, TypedRouterModuleWithVersioning, TypedRouterModuleWithoutVersioning, TypedStatusResponse, VersionExtractor };
