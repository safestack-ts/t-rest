import { HttpMethod } from '@t-rest/protocol';
import { StandardSchemaV1, StandardJSONSchemaV1 } from '@standard-schema/spec';
export { ze } from './zod.js';
import { z } from 'zod';

declare enum Versioning {
    NO_VERSIONING = 0,
    DATE = 1,
    SEMVER = 2
}

/**
 * How a route takes its body: `json`, `multipart/form-data`, or either of
 * them (`.multipart({ json: true })`), e.g. for integrators that keep sending
 * JSON to a route that also accepts uploads.
 */
type BodyEncoding = 'json' | 'multipart' | 'json-or-multipart';

/** A file field of a multipart route, documented as binary in OpenAPI. */
type MultipartFilePart = {
    /** Several files are sent under the same field name. */
    multiple?: boolean;
    required?: boolean;
};
type MultipartFileParts = Record<string, MultipartFilePart>;
type MultipartOptions = {
    /** The route also accepts the body as JSON. */
    json?: boolean;
    /**
     * The file fields, by field name. The validator only sees what the upload
     * middleware made of them, so their names are declared here.
     */
    files?: MultipartFileParts;
};

type HTTPMethod = HttpMethod;

/** A named example, its `value` is typed against what it documents. */
interface Example<TValue> {
    readonly summary?: string;
    readonly description?: string;
    readonly value: TValue;
}
type Examples<TValue> = Readonly<Record<string, Example<TValue>>>;
/** Documentation of a response, only read by documentation generators. */
interface ResponseOptions<TBody> {
    /** The generator falls back to the reason phrase of the status. */
    readonly description?: string;
    /** One object schema, each property is a response header. */
    readonly headers?: StandardSchemaV1;
    readonly examples?: Examples<TBody>;
    /** Shares the response between routes, e.g. as a component of an OpenAPI document. */
    readonly id?: string;
}
interface ResponseDescriptor<TKind extends string, TContentType extends string | undefined, TBody> {
    readonly kind: TKind;
    readonly contentType: TContentType;
    readonly ['~body']: TBody;
    /** The schema of a json body, set by `json(schema)`. */
    readonly schema?: StandardSchemaV1;
    readonly description?: string;
    readonly headers?: StandardSchemaV1;
    readonly examples?: Examples<unknown>;
    readonly id?: string;
}
type JsonResponseDescriptor<TBody> = ResponseDescriptor<'json', 'application/json', TBody>;
type TextResponseDescriptor<TContentType extends string = 'text/plain'> = ResponseDescriptor<'text', TContentType, string>;
type BinaryResponseDescriptor<TContentType extends string = string> = ResponseDescriptor<'binary', TContentType, Uint8Array>;
type EmptyResponseDescriptor = ResponseDescriptor<'empty', undefined, undefined>;
type AnyResponseDescriptor = JsonResponseDescriptor<any> | TextResponseDescriptor<string> | BinaryResponseDescriptor | EmptyResponseDescriptor;
/** The responses of a route: HTTP status code to response descriptor. */
type ResponseMap = {
    readonly [status: number]: AnyResponseDescriptor;
};
/**
 * Constrains every property of the responses to a descriptor: the numeric index
 * signature of `ResponseMap` alone accepts any object without numeric keys,
 * e.g. a body type passed where responses are expected.
 */
type StrictResponseMap<TResponses> = ResponseMap & {
    readonly [TKey in keyof TResponses]: AnyResponseDescriptor;
};
/** The statuses a route declares, of a union of routes those of every member. */
type DeclaredStatus<TRoute extends {
    '~responses': unknown;
}> = TRoute extends unknown ? keyof TRoute['~responses'] & number : never;
/**
 * The descriptor of a status, a status enum member resolves like its value.
 * A union of routes yields the descriptors of the members declaring it.
 */
type ResponseDescriptorOf<TRoute extends {
    '~responses': unknown;
}, TStatus extends number> = TRoute extends unknown ? TStatus extends keyof TRoute['~responses'] ? TRoute['~responses'][TStatus] : never : never;
/** The body type of the given statuses of a route, by default of all of them. */
type BodyOf<TRoute extends {
    '~responses': unknown;
}, TStatus extends number = DeclaredStatus<TRoute>> = ResponseDescriptorOf<TRoute, TStatus> extends infer TDescriptor ? TDescriptor extends ResponseDescriptor<string, string | undefined, infer TBody> ? TBody : never : never;
/**
 * The body a consumer decodes for a descriptor: the json body, a string for
 * text, and its own representations of binary and empty bodies.
 */
type DecodedBody<TDescriptor, TBinary = Uint8Array, TEmpty = undefined> = TDescriptor extends JsonResponseDescriptor<infer TBody> ? TBody : TDescriptor extends TextResponseDescriptor<string> ? string : TDescriptor extends BinaryResponseDescriptor ? TBinary : TDescriptor extends EmptyResponseDescriptor ? TEmpty : never;

declare class RouteDef<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TValidator, TResponses extends StrictResponseMap<TResponses>, TMetaData, TBodyEncoding extends BodyEncoding = 'json'> {
    readonly version: TVersion;
    readonly method: TMethod;
    readonly path: TPath;
    readonly validator: TValidator;
    readonly responses: TResponses;
    readonly ['~responses']: TResponses;
    readonly ['~validatorOutputType']: TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TValidator> : never;
    readonly metaData: TMetaData;
    readonly bodyEncoding: TBodyEncoding;
    readonly multipartFiles: MultipartFileParts | undefined;
    /** Example requests from `.validate(validator, { examples })`. */
    readonly requestExamples: Examples<unknown> | undefined;
    constructor(version: TVersion, method: TMethod, path: TPath, validator: TValidator, responses: TResponses, metaData: TMetaData, bodyEncoding?: TBodyEncoding, multipartFiles?: MultipartFileParts, requestExamples?: Examples<unknown>);
}

type AnyRouteValidator = StandardSchemaV1<{
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: any;
    headers?: Record<string, unknown>;
    [key: string]: any;
}>;

type AnyRouteDef = RouteDef<string, HTTPMethod, string, AnyRouteValidator, any, unknown, BodyEncoding>;

/** Keys a quoted status like `'400'` by its number, the same property at runtime. */
type NumericStatusKeys<TResponses> = {
    [TKey in keyof TResponses as TKey extends `${infer TStatus extends number}` ? `${TStatus}` extends TKey ? TStatus : TKey : TKey]: TResponses[TKey];
};
/** A route whose responses are filled with the defaults, its own declarations win. */
type WithDefaultResponses<TRoute, TDefaults> = TRoute extends RouteDef<infer TVersion extends string, infer TMethod extends HTTPMethod, infer TPath extends string, infer TValidator extends AnyRouteValidator, infer TResponses, infer TMetaData, infer TBodyEncoding extends BodyEncoding> ? Omit<NumericStatusKeys<TDefaults>, keyof NumericStatusKeys<TResponses>> & NumericStatusKeys<TResponses> extends infer TMerged extends StrictResponseMap<TMerged> ? RouteDef<TVersion, TMethod, TPath, TValidator, TMerged, TMetaData, TBodyEncoding> : never : never;

type HashFunction<TKey> = (input: TKey) => string;
/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare class HashMap<TKey, TValue> {
    private readonly _map;
    private readonly _keys;
    private readonly hashFunc;
    constructor(hashFunc: HashFunction<TKey>, entries: readonly (readonly [TKey, TValue])[]);
    constructor(hashFunc: HashFunction<TKey>);
    set(key: TKey, value: TValue): this;
    get(key: TKey): TValue | undefined;
    has(key: TKey): boolean;
    delete(key: TKey): boolean;
    clear(): void;
    keys(): IterableIterator<TKey>;
    values(): IterableIterator<TValue>;
    get size(): number;
    entries(): IterableIterator<[TKey, TValue]>;
    toJSON(): [TKey, TValue][];
    toString(): string;
}

type RouteHashMap = HashMap<[HTTPMethod, string, string], AnyRouteDef>;

type VersioningRequired = Exclude<Versioning, Versioning.NO_VERSIONING>;

declare class BagOfRoutesBuilderWithVersioning<TRoutes extends AnyRouteDef, TVersioning extends VersioningRequired, TVersionHistory extends string[]> {
    protected readonly routes: RouteHashMap;
    private readonly versioning;
    private readonly versionHistory;
    constructor(versioning: TVersioning, versionHistory: TVersionHistory, routes?: RouteHashMap);
    addRoute<TVersion extends TVersionHistory[number], TRouteDef extends RouteDef<TVersion, HTTPMethod, string, any, any, unknown, BodyEncoding>>(route: TRouteDef): BagOfRoutesBuilderWithVersioning<TRoutes | TRouteDef, TVersioning, TVersionHistory>;
    build(): BagOfRoutes<TRoutes, TVersioning, TVersionHistory>;
}

declare class BagOfRoutesBuilderWithoutVersioning<TRoutes extends AnyRouteDef> {
    protected readonly routes: RouteHashMap;
    constructor(routes?: RouteHashMap);
    addRoute<TRouteDef extends RouteDef<string, HTTPMethod, string, any, any, unknown, BodyEncoding>>(route: TRouteDef): BagOfRoutesBuilderWithoutVersioning<TRoutes | TRouteDef>;
    build(): BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>;
}

declare class BagOfRoutes<_TRoutes extends AnyRouteDef, TVersioning extends Versioning, TVersionHistory extends string[]> {
    readonly routes: RouteHashMap;
    readonly versioning: TVersioning;
    readonly versionHistory: TVersionHistory;
    constructor(routes: RouteHashMap, versioning: TVersioning, versionHistory: TVersionHistory);
    /**
     * A bag whose routes declare the default responses for the statuses they do
     * not declare themselves, e.g. `{ 400: json(ValidationErrorBody) }`.
     */
    withDefaultResponses<TDefaults extends StrictResponseMap<TDefaults>>(defaults: TDefaults): BagOfRoutes<WithDefaultResponses<_TRoutes, TDefaults>, TVersioning, TVersionHistory>;
    static withVersioning<TVersioning extends VersioningRequired, TVersionHistory extends string[]>(versioning: TVersioning, versionHistory: TVersionHistory): BagOfRoutesBuilderWithVersioning<never, TVersioning, TVersionHistory>;
    static withoutVersioning(): BagOfRoutesBuilderWithoutVersioning<never>;
}

interface EmptySchema extends StandardSchemaV1<{}>, StandardJSONSchemaV1<{}> {
    type: 'empty';
    readonly '~standard': StandardSchemaV1.Props<{}> & StandardJSONSchemaV1.Props<{}>;
}
declare const emptyValidation: EmptySchema;
type EmptyValidation = StandardSchemaV1.InferOutput<EmptySchema>;

declare const securitySchemeBrand: unique symbol;
interface OAuthFlow {
    readonly refreshUrl?: string;
    /** Scope name to its description. */
    readonly scopes: Readonly<Record<string, string>>;
}
interface OAuthFlows {
    readonly authorizationCode?: OAuthFlow & {
        readonly authorizationUrl: string;
        readonly tokenUrl: string;
    };
    readonly clientCredentials?: OAuthFlow & {
        readonly tokenUrl: string;
    };
    readonly implicit?: OAuthFlow & {
        readonly authorizationUrl: string;
    };
    readonly password?: OAuthFlow & {
        readonly tokenUrl: string;
    };
}
/** How a client authenticates, in the vocabulary of OpenAPI security schemes. */
type SecuritySchemeSpec = {
    readonly description?: string;
} & ({
    readonly type: 'http';
    readonly scheme: 'bearer';
    readonly bearerFormat?: string;
} | {
    readonly type: 'http';
    readonly scheme: 'basic';
} | {
    readonly type: 'apiKey';
    readonly in: 'header' | 'query' | 'cookie';
    readonly name: string;
} | {
    readonly type: 'oauth2';
    readonly flows: OAuthFlows;
} | {
    readonly type: 'openIdConnect';
    readonly openIdConnectUrl: string;
});
/** The scope names an oauth2 scheme declares in any of its flows. */
type SecuritySchemeScope<TSpec extends SecuritySchemeSpec> = TSpec extends {
    readonly type: 'oauth2';
    readonly flows: infer TFlows;
} ? {
    [TFlow in keyof TFlows]-?: TFlows[TFlow] extends {
        readonly scopes: infer TScopes;
    } ? keyof TScopes & string : never;
}[keyof TFlows] : never;
/** A security scheme requested with scopes. */
interface ScopedSecurityScheme {
    readonly scheme: SecurityScheme;
    readonly scopes: readonly string[];
}
/** Created by `securityScheme()`, routes reference it in `meta.security`. */
interface SecurityScheme<TName extends string = string, TSpec extends SecuritySchemeSpec = SecuritySchemeSpec> {
    readonly [securitySchemeBrand]: true;
    readonly name: TName;
    readonly spec: TSpec;
    scopes(...scopes: SecuritySchemeScope<TSpec>[]): ScopedSecurityScheme;
}
/**
 * Alternatives of requirements, each satisfied by all of its schemes. `[]` is
 * public, `[[bearer], []]` makes authentication optional.
 */
type SecurityRequirements = readonly (readonly (SecurityScheme | ScopedSecurityScheme)[])[];

/**
 * The documented meta data of a route. `.metaData()` checks these keys and
 * keeps any other key with its own type, e.g. `public: true` for a filter.
 */
interface RouteMeta {
    readonly summary?: string;
    readonly description?: string;
    readonly tags?: readonly string[];
    readonly deprecated?: boolean;
    readonly operationId?: string;
    readonly externalDocs?: {
        readonly url: string;
        readonly description?: string;
    };
    readonly servers?: readonly {
        readonly url: string;
        readonly description?: string;
        readonly variables?: Readonly<Record<string, {
            readonly default: string;
            readonly description?: string;
            readonly enum?: readonly string[];
        }>>;
    }[];
    readonly security?: SecurityRequirements;
}
/** Checks the keys of `RouteMeta` in a meta data type, other keys pass as they are. */
type CheckMeta<TMeta> = {
    [TKey in keyof TMeta]: TKey extends keyof RouteMeta ? RouteMeta[TKey] : unknown;
};

declare class RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TValidator, TMetaData, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private validator;
    private metaData;
    private bodyEncoding?;
    private multipartFiles?;
    private requestExamples?;
    constructor(version: TVersion, method: TMethod, path: TPath, validator: TValidator, metaData: TMetaData, bodyEncoding?: TBodyEncoding | undefined, multipartFiles?: MultipartFileParts | undefined, requestExamples?: Examples<unknown> | undefined);
    responses<TResponses extends StrictResponseMap<TResponses>>(responses: TResponses): RouteDef<TVersion, TMethod, TPath, TValidator, TResponses, TMetaData, TBodyEncoding>;
    /**
     * Shorthand for `.responses({ [status]: json<TResponse>() })`, the status
     * defaults to `200`. `.response(204)` declares an empty body.
     */
    response<TResponse>(status?: 200): RouteDef<TVersion, TMethod, TPath, TValidator, {
        200: JsonResponseDescriptor<TResponse>;
    }, TMetaData, TBodyEncoding>;
    response<TResponse>(status: 201): RouteDef<TVersion, TMethod, TPath, TValidator, {
        201: JsonResponseDescriptor<TResponse>;
    }, TMetaData, TBodyEncoding>;
    response<TResponse>(status: 202): RouteDef<TVersion, TMethod, TPath, TValidator, {
        202: JsonResponseDescriptor<TResponse>;
    }, TMetaData, TBodyEncoding>;
    response(status: 204): RouteDef<TVersion, TMethod, TPath, TValidator, {
        204: EmptyResponseDescriptor;
    }, TMetaData, TBodyEncoding>;
}

declare class RouteBuilderWithVersionAndMethodAndPathAndValidator<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TValidator, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private validator;
    private bodyEncoding?;
    private multipartFiles?;
    private requestExamples?;
    constructor(version: TVersion, method: TMethod, path: TPath, validator: TValidator, bodyEncoding?: TBodyEncoding | undefined, multipartFiles?: MultipartFileParts | undefined, requestExamples?: Examples<unknown> | undefined);
    metaData<TMetaData extends CheckMeta<TMetaData>>(metaData: TMetaData): RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<TVersion, TMethod, TPath, TValidator, TMetaData, TBodyEncoding>;
    responses<TResponses extends StrictResponseMap<TResponses>>(responses: TResponses): RouteDef<TVersion, TMethod, TPath, TValidator, TResponses, unknown, TBodyEncoding>;
    /**
     * Shorthand for `.responses({ [status]: json<TResponse>() })`, the status
     * defaults to `200`. `.response(204)` declares an empty body.
     */
    response<TResponse>(status?: 200): RouteDef<TVersion, TMethod, TPath, TValidator, {
        200: JsonResponseDescriptor<TResponse>;
    }, unknown, TBodyEncoding>;
    response<TResponse>(status: 201): RouteDef<TVersion, TMethod, TPath, TValidator, {
        201: JsonResponseDescriptor<TResponse>;
    }, unknown, TBodyEncoding>;
    response<TResponse>(status: 202): RouteDef<TVersion, TMethod, TPath, TValidator, {
        202: JsonResponseDescriptor<TResponse>;
    }, unknown, TBodyEncoding>;
    response(status: 204): RouteDef<TVersion, TMethod, TPath, TValidator, {
        204: EmptyResponseDescriptor;
    }, unknown, TBodyEncoding>;
}

interface ValidateOptions<TValidator> {
    /** Example requests, typed against the input of the validator. */
    readonly examples?: Examples<TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferInput<TValidator> : never>;
}

declare class RouteBuilderWithVersionAndMethodAndPathAndMetaData<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TMetaData, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private metaData;
    private bodyEncoding?;
    private multipartFiles?;
    constructor(version: TVersion, method: TMethod, path: TPath, metaData: TMetaData, bodyEncoding?: TBodyEncoding | undefined, multipartFiles?: MultipartFileParts | undefined);
    validate<TValidator>(validator: TValidator, options?: ValidateOptions<TValidator>): RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<TVersion, TMethod, TPath, TValidator, TMetaData, TBodyEncoding>;
    responses<TResponses extends StrictResponseMap<TResponses>>(responses: TResponses): RouteDef<TVersion, TMethod, TPath, EmptySchema, TResponses, TMetaData, TBodyEncoding>;
    /**
     * Shorthand for `.responses({ [status]: json<TResponse>() })`, the status
     * defaults to `200`. `.response(204)` declares an empty body.
     */
    response<TResponse>(status?: 200): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        200: JsonResponseDescriptor<TResponse>;
    }, TMetaData, TBodyEncoding>;
    response<TResponse>(status: 201): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        201: JsonResponseDescriptor<TResponse>;
    }, TMetaData, TBodyEncoding>;
    response<TResponse>(status: 202): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        202: JsonResponseDescriptor<TResponse>;
    }, TMetaData, TBodyEncoding>;
    response(status: 204): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        204: EmptyResponseDescriptor;
    }, TMetaData, TBodyEncoding>;
}

type BodyMethod = Exclude<HTTPMethod, 'GET' | 'DELETE'>;
declare class RouteBuilderWithVersionAndMethodAndPath<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private bodyEncoding?;
    private multipartFiles?;
    constructor(version: TVersion, method: TMethod, path: TPath, bodyEncoding?: TBodyEncoding | undefined, multipartFiles?: MultipartFileParts | undefined);
    /**
     * Declares that the route takes `multipart/form-data`. Parsing the upload
     * stays up to a route middleware, the validator describes its result.
     * GET and DELETE never send a body and are rejected.
     *
     * `json: true` keeps accepting the body as JSON too, `files` names the file
     * fields so OpenAPI documents them.
     */
    multipart<const TOptions extends MultipartOptions = {}>(this: RouteBuilderWithVersionAndMethodAndPath<TVersion, TMethod & BodyMethod, TPath, TBodyEncoding>, options?: TOptions): RouteBuilderWithVersionAndMethodAndPath<TVersion, TMethod, TPath, TOptions extends {
        json: true;
    } ? "json-or-multipart" : "multipart">;
    validate<TValidator>(validator: TValidator, options?: ValidateOptions<TValidator>): RouteBuilderWithVersionAndMethodAndPathAndValidator<TVersion, TMethod, TPath, TValidator, TBodyEncoding>;
    metaData<TMetaData extends CheckMeta<TMetaData>>(metaData: TMetaData): RouteBuilderWithVersionAndMethodAndPathAndMetaData<TVersion, TMethod, TPath, TMetaData, TBodyEncoding>;
    responses<TResponses extends StrictResponseMap<TResponses>>(responses: TResponses): RouteDef<TVersion, TMethod, TPath, EmptySchema, TResponses, unknown, TBodyEncoding>;
    /**
     * Shorthand for `.responses({ [status]: json<TResponse>() })`, the status
     * defaults to `200`. `.response(204)` declares an empty body.
     */
    response<TResponse>(status?: 200): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        200: JsonResponseDescriptor<TResponse>;
    }, unknown, TBodyEncoding>;
    response<TResponse>(status: 201): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        201: JsonResponseDescriptor<TResponse>;
    }, unknown, TBodyEncoding>;
    response<TResponse>(status: 202): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        202: JsonResponseDescriptor<TResponse>;
    }, unknown, TBodyEncoding>;
    response(status: 204): RouteDef<TVersion, TMethod, TPath, typeof emptyValidation, {
        204: EmptyResponseDescriptor;
    }, unknown, TBodyEncoding>;
}

declare class RouteWithVersion<TVersion extends string> {
    private version;
    constructor(version: TVersion);
    get<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<TVersion, "GET", TPath, "json">;
    post<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<TVersion, "POST", TPath, "json">;
    put<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<TVersion, "PUT", TPath, "json">;
    patch<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<TVersion, "PATCH", TPath, "json">;
    delete<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<TVersion, "DELETE", TPath, "json">;
}

declare abstract class Route {
    static version<TVersion extends string>(version: TVersion): RouteWithVersion<TVersion>;
    static get<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<"", "GET", TPath, "json">;
    static post<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<"", "POST", TPath, "json">;
    static put<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<"", "PUT", TPath, "json">;
    static patch<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<"", "PATCH", TPath, "json">;
    static delete<TPath extends string>(path: TPath): RouteBuilderWithVersionAndMethodAndPath<"", "DELETE", TPath, "json">;
}

declare class ValidationError extends Error {
    readonly issues: readonly StandardSchemaV1.Issue[];
    constructor(issues: readonly StandardSchemaV1.Issue[]);
    static isValidationError(error: unknown): error is ValidationError;
    static [Symbol.hasInstance](instance: unknown): boolean;
    toString(): string;
}

type AddReadonlyDeep<T> = T extends Record<PropertyKey, unknown> ? {
    +readonly [K in keyof T]: AddReadonlyDeep<T[K]>;
} : T extends Array<infer U> ? ReadonlyArray<AddReadonlyDeep<U>> : T;

type CombinedBags<TRoutes extends AnyRouteDef, TBags extends BagOfRoutes<any, Versioning, any>[]> = TBags extends [
    BagOfRoutes<infer TRoute, infer TVersioning, infer TVersionHistory>,
    ...infer TRemainingClients
] ? TRemainingClients extends BagOfRoutes<any, TVersioning, TVersionHistory>[] ? CombinedBags<TRoutes | TRoute, TRemainingClients> : TRoutes : TRoutes;

type ExtractRoutes<TBagOfRoutes extends BagOfRoutes<AnyRouteDef, any, any>> = TBagOfRoutes extends BagOfRoutes<infer TRoutes, any, any> ? TRoutes : never;
type ExtractRoute<TBagOfRoutes, TMethod extends HTTPMethod, TPath extends string> = TBagOfRoutes extends BagOfRoutes<AnyRouteDef, Versioning, any> ? Extract<ExtractRoutes<TBagOfRoutes>, {
    method: TMethod;
    path: TPath;
}> : never;

type InferMetaData<T extends AnyRouteDef> = T extends RouteDef<any, any, any, any, any, infer TMetaData, any> ? TMetaData : never;

type StripTrailingSlash<TPath extends string> = TPath extends `${infer T}/` ? T : TPath;
type JoinPathTail<TPath1 extends string, TPath2 extends string> = `${StripTrailingSlash<TPath1>}${StripTrailingSlash<TPath2>}` extends '' ? '/' : StripTrailingSlash<TPath2>;
type JoinPath<TPath1 extends string, TPath2 extends string> = `${StripTrailingSlash<TPath1>}${JoinPathTail<TPath1, TPath2>}`;

type NonEmptyArray<Type> = [Type, ...Type[]];
/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const isNonEmptyArray: <T>(arr: T[]) => arr is NonEmptyArray<T>;
/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const first: <T>(arr: NonEmptyArray<T>) => T;
/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const last: <T>(arr: NonEmptyArray<T>) => T;

type PrefixString<TString extends string, TPrefix extends string> = `${TPrefix}${TString}`;

type RemoveReadonlyDeep<T> = T extends Record<PropertyKey, unknown> ? {
    -readonly [K in keyof T]: RemoveReadonlyDeep<T[K]>;
} : T extends readonly unknown[] ? RemoveReadonlyDeepArray<T> : T;
type RemoveReadonlyDeepArray<Array extends readonly unknown[]> = Array extends readonly [infer First, ...infer Rest] ? [RemoveReadonlyDeep<First>, ...RemoveReadonlyDeepArray<Rest>] : [];

type StringReplaceHead<TString extends string, TNeedle extends string, TReplace extends string> = TString extends `${TNeedle}${infer TRest}` ? `${TReplace}${TRest}` : TString;

type StringStartsWith<TString extends string, TStart extends string> = TString extends `${TStart}${infer _Rest}` ? TString : never;

type SuffixString<TString extends string, TSuffix extends string> = `${TString}${TSuffix}`;

type WithoutLeadingSlash<TPath extends string> = TPath extends `/${infer T}` ? T : TPath;
type WithoutTrailingSlash<TPath extends string> = TPath extends '/' ? TPath : TPath extends `${infer T}/` ? T : TPath;

type SearchRoute<TRoutes extends AnyRouteDef, TVersionClient extends string, TVersionHistory extends string[]> = Extract<TRoutes, {
    version: TVersionClient;
}> extends never ? TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion] ? TCurrentVersion extends string ? TOlderVersions extends string[] ? SearchRoute<TRoutes, TCurrentVersion, TOlderVersions> : never : never : never : Extract<TRoutes, {
    version: TVersionClient;
}>;
type ExtractVersionMatchingRoute<TRoutes extends AnyRouteDef, TClientVersion extends string, TVersionHistory extends string[]> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion] ? TCurrentVersion extends TClientVersion ? TOlderVersions extends string[] ? SearchRoute<TRoutes, TCurrentVersion, TOlderVersions> : never : TOlderVersions extends string[] ? ExtractVersionMatchingRoute<TRoutes, TClientVersion, TOlderVersions> : never : never;
type ExtractLatestMatchingRoutePerPath<TRoutes extends AnyRouteDef, TClientVersion extends string, TVersionHistory extends string[]> = {
    [Path in TRoutes['path']]: ExtractVersionMatchingRoute<Extract<TRoutes, {
        path: Path;
    }>, TClientVersion, TVersionHistory>;
}[TRoutes['path']];

type RouteValidationOutput<TRoute extends AnyRouteDef> = TRoute extends RouteDef<any, any, any, infer TValidator, any, any, any> ? TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TValidator> : never : never;

type RouteValidationInput<TRoute extends AnyRouteDef> = TRoute extends RouteDef<any, any, any, infer TValidator, any, any, any> ? TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferInput<TValidator> : never : never;

type OmitFromEach<T, TKeys extends PropertyKey> = T extends unknown ? Omit<T, TKeys> : never;
type MultipartRequestInput<TRoute extends AnyRouteDef, TMultipartInput> = OmitFromEach<RouteValidationInput<TRoute>, 'body' | 'file' | 'files'> & TMultipartInput;
/**
 * The input a binding sends for a route. On a multipart route the validator
 * describes the request after the upload middleware parsed it, so `body` and
 * the `file`/`files` keys that middleware adds give way to the wire format of
 * the binding. A route taking either encoding takes either input, the JSON
 * one without the keys only an upload produces.
 */
type RouteRequestInput<TRoute extends AnyRouteDef, TMultipartInput> = TRoute extends RouteDef<any, any, any, any, any, any, infer TBodyEncoding> ? TBodyEncoding extends 'multipart' ? MultipartRequestInput<TRoute, TMultipartInput> : TBodyEncoding extends 'json-or-multipart' ? OmitFromEach<RouteValidationInput<TRoute>, 'file' | 'files'> | MultipartRequestInput<TRoute, TMultipartInput> : RouteValidationInput<TRoute> : never;

type OlderVersions<TVersionHistory extends string[], TVersion extends TVersionHistory[number]> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion] ? TCurrentVersion extends TVersion ? TOlderVersions extends string[] ? TOlderVersions[number] : never : TOlderVersions extends string[] ? OlderVersions<TOlderVersions, TVersion> : never : never;

type NewerVersions<TVersionHistory extends string[], TVersion extends TVersionHistory[number]> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion] ? TCurrentVersion extends TVersion ? never : TOlderVersions extends string[] ? TCurrentVersion | NewerVersions<TOlderVersions, TVersion> : never : never;

type PrefixMatchingRoutes<TRoutes extends AnyRouteDef, TPrefix extends string> = TRoutes extends AnyRouteDef ? StringStartsWith<TRoutes['path'], TPrefix> extends never ? never : TRoutes : never;

type BagOfRoutesVersions<TBagOfRoutes extends BagOfRoutes<any, any, any>> = TBagOfRoutes extends BagOfRoutes<any, any, infer TVersionHistory> ? TVersionHistory[number] : never;

type WithoutDoubleSlash<TPath extends string> = TPath extends `${infer T}//${infer U}` ? WithoutDoubleSlash<`${T}/${U}`> : TPath;

type RouteAt<TBagOfRoutes extends BagOfRoutes<any, any, any>, TMethod extends HTTPMethod, TPath extends string, TVersion extends string> = TBagOfRoutes extends BagOfRoutes<infer TRoutes extends AnyRouteDef, any, any> ? Extract<TRoutes, {
    method: TMethod;
    path: TPath;
    version: TVersion;
}> : never;
type RouteInput<TBagOfRoutes extends BagOfRoutes<any, any, any>, TMethod extends HTTPMethod, TPath extends string, TVersion extends string = ''> = RouteAt<TBagOfRoutes, TMethod, TPath, TVersion>['~validatorOutputType'];
/**
 * The body type of a route, of the given statuses or by default the union of
 * the bodies of all statuses it declares.
 */
type RouteOutput<TBagOfRoutes extends BagOfRoutes<any, any, any>, TMethod extends HTTPMethod, TPath extends string, TVersion extends string = '', TStatus extends number = DeclaredStatus<RouteAt<TBagOfRoutes, TMethod, TPath, TVersion>>> = BodyOf<RouteAt<TBagOfRoutes, TMethod, TPath, TVersion>, TStatus>;

type EnsureSameVersioning<T extends BagOfRoutes<any, any, any>[]> = T extends [] ? never : T extends [infer _First extends BagOfRoutes<any, any, any>] ? T : T extends [
    infer First extends BagOfRoutes<any, any, any>,
    ...infer Rest extends BagOfRoutes<any, any, any>[]
] ? First['versioning'] extends Rest[number]['versioning'] ? Rest[number]['versioning'] extends First['versioning'] ? T : never : never : never;
declare const combine: <TBags extends NonEmptyArray<BagOfRoutes<AnyRouteDef, any, any>>, TVersioning extends TBags[number]["versioning"], TVersionHistory extends TBags[number]["versionHistory"]>(...bags: EnsureSameVersioning<TBags>) => BagOfRoutes<CombinedBags<never, TBags>, TVersioning, TVersionHistory>;

/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const TypedIdentity: <Shape>() => <const Value extends AddReadonlyDeep<Shape>>(value: Value) => RemoveReadonlyDeep<Value>;
/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const Identity: <const T>(value: T) => T;

/** @deprecated Use `joinPaths` from `@t-rest/protocol`. */
declare const joinPath: (prefix: string, path: string) => string;

/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const typedLowerCase: <T extends string>(str: T) => Lowercase<T>;
/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const typedUpperCase: <T extends string>(str: T) => Uppercase<T>;

declare const VersionHistory: <TVersions extends readonly string[]>(versions: TVersions) => RemoveReadonlyDeep<TVersions>;

/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const versionHistory: ["2024-01-01", "2024-02-01", "2024-03-01"];
/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare const demoBagOfRoutes: BagOfRoutes<RouteDef<"2024-01-01", "GET", "/basket", EmptySchema, {
    200: JsonResponseDescriptor<{
        id: string;
        entries: any[];
    }>;
}, unknown, "json"> | RouteDef<"2024-01-01", "GET", "/basket/:basketId/entries", z.ZodObject<{
    params: z.ZodObject<{
        basketId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, {
    200: JsonResponseDescriptor<any[]>;
}, unknown, "json"> | RouteDef<"2024-03-01", "POST", "/basket", z.ZodObject<{
    body: z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, {
    200: JsonResponseDescriptor<{
        id: string;
    }>;
}, unknown, "json">, Versioning.DATE, ["2024-01-01", "2024-02-01", "2024-03-01"]>;

declare const resolveVersion: (versionHistory: string[], availableVersions: string[], requestedVersion: string) => string | null;
declare const resolveDateVersion: (versionHistory: string[], availableVersions: string[], requestedVersion: string, parseDate: (version: string) => Date) => string | null;

/**
 * Creates a lookup of the route a server executes for a request: the route of
 * the requested version, else the newest route of an older version of the
 * history. With `parseDate` versions outside of the history are resolved by
 * date, like a server with a date version extractor does. Unversioned routes
 * are looked up with the version `''`.
 *
 * The versions of each route are indexed once, so the routes must not change
 * afterwards.
 */
declare const createRouteResolver: (routes: RouteHashMap, versionHistory: readonly string[], parseDate?: (version: string) => Date) => (method: HTTPMethod, path: string, version: string) => AnyRouteDef | undefined;

/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare function findNearestLowerDate(sortedDates: Date[], needleDate: Date): {
    lowerDate: Date;
    lowerDateIndex: number;
} | null;

/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare function isDefined<Value>(value: Value | null | undefined): value is Value;

/** @deprecated Use `pathShape` from `@t-rest/protocol`. */
declare const normalizePathPattern: (path: string) => string;

type SchemaOutput<TSchema> = StandardSchemaV1.InferOutput<TSchema & StandardSchemaV1>;
type UntypedJsonOptions<TBody> = ResponseOptions<TBody> & {
    readonly '~standard'?: never;
};
/** A json body typed and documented by the output of its schema. */
declare function json<TSchema>(schema: TSchema & {
    readonly '~standard': StandardSchemaV1.Props & TSchema['~standard' & keyof TSchema];
}, options?: ResponseOptions<SchemaOutput<TSchema>>): JsonResponseDescriptor<SchemaOutput<TSchema>>;
/** A json body typed by a type argument, documented by the options only. */
declare function json<TBody>(options?: UntypedJsonOptions<TBody>): JsonResponseDescriptor<TBody>;
/** A text body, `text/plain` unless another content type is given. */
declare function text(contentType?: undefined, options?: ResponseOptions<string>): TextResponseDescriptor<'text/plain'>;
declare function text<TContentType extends string>(contentType: TContentType, options?: ResponseOptions<string>): TextResponseDescriptor<TContentType>;
declare function text<TContentType extends string>(contentType?: TContentType, options?: ResponseOptions<string>): TextResponseDescriptor<TContentType | 'text/plain'>;
declare const binary: <TContentType extends string>(contentType: TContentType, options?: Omit<ResponseOptions<Uint8Array>, "examples">) => BinaryResponseDescriptor<TContentType>;
declare const empty: (options?: Omit<ResponseOptions<undefined>, "examples">) => EmptyResponseDescriptor;

/**
 * Declares a security scheme, `name` is its name in documentation. Routes
 * reference the returned value in `meta.security`.
 */
declare const securityScheme: <const TName extends string, const TSpec extends SecuritySchemeSpec>(name: TName, spec: TSpec) => SecurityScheme<TName, TSpec>;

export { BagOfRoutes, BagOfRoutesBuilderWithVersioning, BagOfRoutesBuilderWithoutVersioning, HashMap, Identity, Route, RouteBuilderWithVersionAndMethodAndPath, RouteBuilderWithVersionAndMethodAndPathAndMetaData, RouteBuilderWithVersionAndMethodAndPathAndValidator, RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData, RouteDef, RouteWithVersion, TypedIdentity, ValidationError, VersionHistory, Versioning, binary, combine, createRouteResolver, demoBagOfRoutes, empty, emptyValidation, findNearestLowerDate, first, isDefined, isNonEmptyArray, joinPath, json, last, normalizePathPattern, resolveDateVersion, resolveVersion, securityScheme, text, typedLowerCase, typedUpperCase, versionHistory };
export type { AddReadonlyDeep, AnyResponseDescriptor, AnyRouteDef, AnyRouteValidator, BagOfRoutesVersions, BinaryResponseDescriptor, BodyEncoding, BodyOf, CheckMeta, CombinedBags, DeclaredStatus, DecodedBody, EmptyResponseDescriptor, EmptySchema, EmptyValidation, Example, Examples, ExtractLatestMatchingRoutePerPath, ExtractRoute, ExtractRoutes, ExtractVersionMatchingRoute, HTTPMethod, InferMetaData, JoinPath, JsonResponseDescriptor, MultipartFilePart, MultipartFileParts, MultipartOptions, NewerVersions, NonEmptyArray, OAuthFlows, OlderVersions, PrefixMatchingRoutes, PrefixString, RemoveReadonlyDeep, RemoveReadonlyDeepArray, ResponseDescriptor, ResponseDescriptorOf, ResponseMap, ResponseOptions, RouteHashMap, RouteInput, RouteMeta, RouteOutput, RouteRequestInput, RouteValidationInput, RouteValidationOutput, ScopedSecurityScheme, SecurityRequirements, SecurityScheme, SecuritySchemeScope, SecuritySchemeSpec, StrictResponseMap, StringReplaceHead, StringStartsWith, SuffixString, TextResponseDescriptor, ValidateOptions, VersioningRequired, WithDefaultResponses, WithoutDoubleSlash, WithoutLeadingSlash, WithoutTrailingSlash };
