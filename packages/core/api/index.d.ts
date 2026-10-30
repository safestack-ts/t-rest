import { HttpMethod } from '@t-rest/protocol';
import { StandardSchemaV1 } from '@standard-schema/spec';
export { ze } from './zod.js';
import { z } from 'zod';

declare enum Versioning {
    NO_VERSIONING = 0,
    DATE = 1,
    SEMVER = 2
}

type BodyEncoding = 'json' | 'multipart';

type HTTPMethod = HttpMethod;

declare class RouteDef<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TValidator, TResponse, TMetaData, TBodyEncoding extends BodyEncoding = BodyEncoding> {
    readonly version: TVersion;
    readonly method: TMethod;
    readonly path: TPath;
    readonly validator: TValidator;
    readonly ['~responseType']: TResponse;
    readonly ['~validatorOutputType']: TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TValidator> : never;
    readonly metaData: TMetaData;
    readonly bodyEncoding: TBodyEncoding;
    constructor(version: TVersion, method: TMethod, path: TPath, validator: TValidator, metaData: TMetaData, bodyEncoding?: TBodyEncoding);
}

type AnyRouteValidator = StandardSchemaV1<{
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: any;
    headers?: Record<string, unknown>;
    [key: string]: any;
}>;

type AnyRouteDef = RouteDef<string, HTTPMethod, string, AnyRouteValidator, any, unknown, BodyEncoding>;

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
    addRoute<TVersion extends TVersionHistory[number], TRouteDef extends RouteDef<TVersion, HTTPMethod, string, any, any, unknown>>(route: TRouteDef): BagOfRoutesBuilderWithVersioning<TRoutes | TRouteDef, TVersioning, TVersionHistory>;
    build(): BagOfRoutes<TRoutes, TVersioning, TVersionHistory>;
}

declare class BagOfRoutesBuilderWithoutVersioning<TRoutes extends AnyRouteDef> {
    protected readonly routes: RouteHashMap;
    constructor(routes?: RouteHashMap);
    addRoute<TRouteDef extends RouteDef<string, HTTPMethod, string, any, any, unknown>>(route: TRouteDef): BagOfRoutesBuilderWithoutVersioning<TRoutes | TRouteDef>;
    build(): BagOfRoutes<TRoutes, Versioning.NO_VERSIONING, never>;
}

declare class BagOfRoutes<_TRoutes extends AnyRouteDef, TVersioning extends Versioning, TVersionHistory extends string[]> {
    readonly routes: RouteHashMap;
    readonly versioning: TVersioning;
    readonly versionHistory: TVersionHistory;
    constructor(routes: RouteHashMap, versioning: TVersioning, versionHistory: TVersionHistory);
    static withVersioning<TVersioning extends VersioningRequired, TVersionHistory extends string[]>(versioning: TVersioning, versionHistory: TVersionHistory): BagOfRoutesBuilderWithVersioning<never, TVersioning, TVersionHistory>;
    static withoutVersioning(): BagOfRoutesBuilderWithoutVersioning<never>;
}

interface EmptySchema extends StandardSchemaV1<{}> {
    type: 'empty';
}
declare const emptyValidation: EmptySchema;
type EmptyValidation = StandardSchemaV1.InferOutput<EmptySchema>;

declare class RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TValidator, TMetaData, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private validator;
    private metaData;
    private bodyEncoding?;
    constructor(version: TVersion, method: TMethod, path: TPath, validator: TValidator, metaData: TMetaData, bodyEncoding?: TBodyEncoding | undefined);
    response<TResponse>(): RouteDef<TVersion, TMethod, TPath, TValidator, TResponse, TMetaData, TBodyEncoding>;
}

declare class RouteBuilderWithVersionAndMethodAndPathAndValidator<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TValidator, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private validator;
    private bodyEncoding?;
    constructor(version: TVersion, method: TMethod, path: TPath, validator: TValidator, bodyEncoding?: TBodyEncoding | undefined);
    metaData<TMetaData>(metaData: TMetaData): RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<TVersion, TMethod, TPath, TValidator, TMetaData, TBodyEncoding>;
    response<TResponse>(): RouteDef<TVersion, TMethod, TPath, TValidator, TResponse, unknown, TBodyEncoding>;
}

declare class RouteBuilderWithVersionAndMethodAndPathAndMetaData<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TMetaData, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private metaData;
    private bodyEncoding?;
    constructor(version: TVersion, method: TMethod, path: TPath, metaData: TMetaData, bodyEncoding?: TBodyEncoding | undefined);
    validate<TValidator>(validator: TValidator): RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<TVersion, TMethod, TPath, TValidator, TMetaData, TBodyEncoding>;
    response<TResponse>(): RouteDef<TVersion, TMethod, TPath, EmptySchema, TResponse, TMetaData, TBodyEncoding>;
}

type BodyMethod = Exclude<HTTPMethod, 'GET' | 'DELETE'>;
declare class RouteBuilderWithVersionAndMethodAndPath<TVersion extends string, TMethod extends HTTPMethod, TPath extends string, TBodyEncoding extends BodyEncoding = 'json'> {
    private version;
    private method;
    private path;
    private bodyEncoding?;
    constructor(version: TVersion, method: TMethod, path: TPath, bodyEncoding?: TBodyEncoding | undefined);
    /**
     * Declares that the route takes `multipart/form-data`. Parsing the upload
     * stays up to a route middleware, the validator describes its result.
     * GET and DELETE never send a body and are rejected.
     */
    multipart(this: RouteBuilderWithVersionAndMethodAndPath<TVersion, TMethod & BodyMethod, TPath, TBodyEncoding>): RouteBuilderWithVersionAndMethodAndPath<TVersion, TMethod, TPath, "multipart">;
    validate<TValidator>(validator: TValidator): RouteBuilderWithVersionAndMethodAndPathAndValidator<TVersion, TMethod, TPath, TValidator, TBodyEncoding>;
    metaData<TMetaData>(metaData: TMetaData): RouteBuilderWithVersionAndMethodAndPathAndMetaData<TVersion, TMethod, TPath, TMetaData, TBodyEncoding>;
    response<TResponse>(): RouteDef<TVersion, TMethod, TPath, EmptySchema, TResponse, unknown, TBodyEncoding>;
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

type InferMetaData<T extends AnyRouteDef> = T extends RouteDef<any, any, any, any, any, infer TMetaData> ? TMetaData : never;

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

type RouteValidationOutput<TRoute extends AnyRouteDef> = TRoute extends RouteDef<any, any, any, infer TValidator, any, any> ? TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<TValidator> : never : never;

type RouteValidationInput<TRoute extends AnyRouteDef> = TRoute extends RouteDef<any, any, any, infer TValidator, any, any> ? TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferInput<TValidator> : never : never;

type OmitFromEach<T, TKeys extends PropertyKey> = T extends unknown ? Omit<T, TKeys> : never;
/**
 * The input a binding sends for a route. On a multipart route the validator
 * describes the request after the upload middleware parsed it, so `body` and
 * the `file`/`files` keys that middleware adds give way to the wire format of
 * the binding.
 */
type RouteRequestInput<TRoute extends AnyRouteDef, TMultipartInput> = TRoute extends RouteDef<any, any, any, any, any, any, 'multipart'> ? OmitFromEach<RouteValidationInput<TRoute>, 'body' | 'file' | 'files'> & TMultipartInput : RouteValidationInput<TRoute>;

type OlderVersions<TVersionHistory extends string[], TVersion extends TVersionHistory[number]> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion] ? TCurrentVersion extends TVersion ? TOlderVersions extends string[] ? TOlderVersions[number] : never : TOlderVersions extends string[] ? OlderVersions<TOlderVersions, TVersion> : never : never;

type NewerVersions<TVersionHistory extends string[], TVersion extends TVersionHistory[number]> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion] ? TCurrentVersion extends TVersion ? never : TOlderVersions extends string[] ? TCurrentVersion | NewerVersions<TOlderVersions, TVersion> : never : never;

type PrefixMatchingRoutes<TRoutes extends AnyRouteDef, TPrefix extends string> = TRoutes extends RouteDef<infer TVersion, infer TMethod, infer TPath, infer TValidator, infer TResponse, infer TMetaData, infer TBodyEncoding> ? StringStartsWith<TPath, TPrefix> extends never ? never : RouteDef<TVersion, TMethod, TPath, TValidator, TResponse, TMetaData, TBodyEncoding> : never;

type BagOfRoutesVersions<TBagOfRoutes extends BagOfRoutes<any, any, any>> = TBagOfRoutes extends BagOfRoutes<any, any, infer TVersionHistory> ? TVersionHistory[number] : never;

type WithoutDoubleSlash<TPath extends string> = TPath extends `${infer T}//${infer U}` ? WithoutDoubleSlash<`${T}/${U}`> : TPath;

type RouteInput<TBagOfRoutes extends BagOfRoutes<any, any, any>, TMethod extends HTTPMethod, TPath extends string, TVersion extends string = ''> = TBagOfRoutes extends BagOfRoutes<infer TRoutes, any, any> ? Extract<TRoutes, {
    method: TMethod;
    path: TPath;
    version: TVersion;
}>['~validatorOutputType'] : never;
type RouteOutput<TBagOfRoutes extends BagOfRoutes<any, any, any>, TMethod extends HTTPMethod, TPath extends string, TVersion extends string = ''> = TBagOfRoutes extends BagOfRoutes<infer TRoutes, any, any> ? Extract<TRoutes, {
    method: TMethod;
    path: TPath;
    version: TVersion;
}>['~responseType'] : never;

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
    id: string;
    entries: any[];
}, unknown, "json"> | RouteDef<"2024-01-01", "GET", "/basket/:basketId/entries", z.ZodObject<{
    params: z.ZodObject<{
        basketId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, any[], unknown, "json"> | RouteDef<"2024-03-01", "POST", "/basket", z.ZodObject<{
    body: z.ZodObject<{
        entries: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, {
    id: string;
}, unknown, "json">, Versioning.DATE, ["2024-01-01", "2024-02-01", "2024-03-01"]>;

declare const resolveVersion: (versionHistory: string[], availableVersions: string[], requestedVersion: string) => string | null;
declare const resolveDateVersion: (versionHistory: string[], availableVersions: string[], requestedVersion: string, parseDate: (version: string) => Date) => string | null;

/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare function findNearestLowerDate(sortedDates: Date[], needleDate: Date): {
    lowerDate: Date;
    lowerDateIndex: number;
} | null;

/** @deprecated Internal helper, will be removed from the public API in a future major. */
declare function isDefined<Value>(value: Value | null | undefined): value is Value;

/** @deprecated Use `pathShape` from `@t-rest/protocol`. */
declare const normalizePathPattern: (path: string) => string;

export { BagOfRoutes, BagOfRoutesBuilderWithVersioning, BagOfRoutesBuilderWithoutVersioning, HashMap, Identity, Route, RouteBuilderWithVersionAndMethodAndPath, RouteBuilderWithVersionAndMethodAndPathAndMetaData, RouteBuilderWithVersionAndMethodAndPathAndValidator, RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData, RouteDef, RouteWithVersion, TypedIdentity, ValidationError, VersionHistory, Versioning, combine, demoBagOfRoutes, emptyValidation, findNearestLowerDate, first, isDefined, isNonEmptyArray, joinPath, last, normalizePathPattern, resolveDateVersion, resolveVersion, typedLowerCase, typedUpperCase, versionHistory };
export type { AddReadonlyDeep, AnyRouteDef, AnyRouteValidator, BagOfRoutesVersions, BodyEncoding, CombinedBags, EmptySchema, EmptyValidation, ExtractLatestMatchingRoutePerPath, ExtractRoute, ExtractRoutes, ExtractVersionMatchingRoute, HTTPMethod, InferMetaData, JoinPath, NewerVersions, NonEmptyArray, OlderVersions, PrefixMatchingRoutes, PrefixString, RemoveReadonlyDeep, RemoveReadonlyDeepArray, RouteHashMap, RouteInput, RouteOutput, RouteRequestInput, RouteValidationInput, RouteValidationOutput, StringReplaceHead, StringStartsWith, SuffixString, VersioningRequired, WithoutDoubleSlash, WithoutLeadingSlash, WithoutTrailingSlash };
