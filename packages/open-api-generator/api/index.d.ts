import { BagOfRoutes, SecurityScheme, SecurityRequirements, RouteMeta } from '@t-rest/core';
import { z } from 'zod';

type Severity = 'error' | 'warning' | 'info';
interface DiagnosticDefinition<TData, TConfigurable extends boolean> {
    readonly severity: Severity;
    /** Whether `config.diagnostics` may change the severity. */
    readonly configurable: TConfigurable;
    readonly title: string;
    /** Markdown: what triggers it. */
    readonly trigger: string;
    /** Markdown: how to resolve it. */
    readonly fix: string;
    readonly message: (data: TData) => string;
}
declare const DIAGNOSTICS: {
    readonly 'operation/meta-not-serializable': DiagnosticDefinition<{
        key: string;
        type: string;
    }, true>;
    readonly 'schema/no-json-schema': DiagnosticDefinition<{
        vendor: string;
    }, false>;
    readonly 'schema/conversion-failed': DiagnosticDefinition<{
        error: string;
    }, false>;
    readonly 'schema/unrepresentable': DiagnosticDefinition<{
        error: string;
        placeholders: string[];
    }, true>;
    readonly 'schema/unrepresentable-request': DiagnosticDefinition<{
        error: string;
        placeholders: string[];
    }, true>;
    readonly 'schema/multipart-placeholder': DiagnosticDefinition<{
        error: string;
        placeholders: string[];
    }, false>;
    readonly 'schema/unsupported-keyword': DiagnosticDefinition<{
        keyword: string;
    }, true>;
    readonly 'schema/unknown-request-slot': DiagnosticDefinition<{
        key: string;
    }, true>;
    readonly 'schema/request-not-object': DiagnosticDefinition<{
        kind: string;
    }, true>;
    readonly 'naming/duplicate-id': DiagnosticDefinition<{
        id: string;
    }, false>;
    readonly 'naming/duplicate-response-id': DiagnosticDefinition<{
        id: string;
    }, false>;
    readonly 'naming/reserved-response-id': DiagnosticDefinition<{
        id: string;
    }, false>;
    readonly 'naming/shared-response-without-description': DiagnosticDefinition<{
        id: string;
        statuses: string[];
    }, true>;
    readonly 'operation/duplicate-route': DiagnosticDefinition<{
        paths: string[];
    }, false>;
    readonly 'operation/invalid-meta': DiagnosticDefinition<{
        key: string;
    }, true>;
    readonly 'operation/example-invalid': DiagnosticDefinition<{
        example: string;
        issues: string[];
    }, false>;
    readonly 'operation/example-unverifiable': DiagnosticDefinition<{
        examples: string[];
        reason: string;
    }, false>;
    readonly 'operation/mixed-query-encoding': DiagnosticDefinition<{
        parameter: string;
    }, true>;
    readonly 'response/untyped-json': DiagnosticDefinition<Record<string, never>, true>;
    readonly 'security/header-and-scheme': DiagnosticDefinition<{
        header: string;
        scheme: string;
    }, true>;
    readonly 'security/reserved-scheme-name': DiagnosticDefinition<{
        name: string;
    }, false>;
    readonly 'security/scheme-name-conflict': DiagnosticDefinition<{
        name: string;
    }, false>;
    readonly 'naming/direction-split': DiagnosticDefinition<{
        id: string;
        input: string;
    }, false>;
    readonly 'naming/anonymous-recursion': DiagnosticDefinition<{
        name: string;
    }, true>;
    readonly 'naming/probable-model-without-id': DiagnosticDefinition<{
        fields: string[];
        operations: string[];
    }, true>;
    readonly 'naming/component-conflict': DiagnosticDefinition<{
        name: string;
        owners: string[];
    }, false>;
    readonly 'operation/duplicate-operation-id': DiagnosticDefinition<{
        operationId: string;
        operations: string[];
    }, false>;
    readonly 'writer/downgrade': DiagnosticDefinition<{
        capability: string;
        target: string;
    }, true>;
    readonly 'writer/discriminator-not-emitted': DiagnosticDefinition<{
        property: string;
    }, false>;
    readonly 'writer/tag-undeclared': DiagnosticDefinition<{
        tag: string;
    }, true>;
    readonly 'config/output-template': DiagnosticDefinition<{
        output: string;
        reason: string;
    }, false>;
    readonly 'config/spec-version': DiagnosticDefinition<{
        output: string;
        reason: string;
    }, false>;
    readonly 'naming/model-without-id': DiagnosticDefinition<{
        key: string;
    }, true>;
    readonly 'output/path-collision': DiagnosticDefinition<{
        path: string;
        outputs: string[];
    }, false>;
};
type Definitions = typeof DIAGNOSTICS;
type DiagnosticCode = keyof Definitions;
type ConfigurableCode = {
    [C in DiagnosticCode]: Definitions[C]['configurable'] extends true ? C : never;
}[DiagnosticCode];
type DiagnosticData<C extends DiagnosticCode> = Parameters<Definitions[C]['message']>[0];
/** Where a diagnostic applies. A route-level diagnostic has `operation`. */
interface Location {
    readonly operation?: string;
    /** `params`, `query`, `headers`, `body`, `response 200`, ... */
    readonly slot?: string;
    /** JSON pointer into the slot's schema, or into the document for writer diagnostics. */
    readonly pointer?: string;
    /** The output of the spec a selection or writer diagnostic belongs to. */
    readonly spec?: string;
}
type Diagnostic = {
    [C in DiagnosticCode]: {
        readonly code: C;
        readonly severity: Severity;
        readonly at: Location;
        readonly data: DiagnosticData<C>;
        /** Ends with the link to the code's reference entry. */
        readonly message: string;
    };
}[DiagnosticCode];
declare class OpenAPIGenerationError extends Error {
    readonly diagnostics: readonly Diagnostic[];
    readonly name = "OpenAPIGenerationError";
    constructor(diagnostics: readonly Diagnostic[]);
}

declare const brand: unique symbol;
type Brand<T, B extends string> = T & {
    readonly [brand]: B;
};
/**
 * Identity of a type inside one generator run:
 * `input:<id>` / `output:<id>` for author ids, and
 * `anon:<direction>:<id>#<json pointer>` for recursion without an id inside a
 * named def, `anon:<operation key>#<slot>#<json pointer>` outside any.
 */
type DefKey = Brand<string, 'DefKey'>;
/** Minted only by naming; the writer accepts nothing else. */
type ComponentName = Brand<string, 'ComponentName'>;
type Literal = string | number | boolean;
interface Docs {
    readonly title?: string;
    readonly description?: string;
    readonly examples?: readonly unknown[];
    readonly default?: unknown;
    readonly deprecated?: boolean;
    readonly readOnly?: boolean;
    readonly writeOnly?: boolean;
    /** `x-*` keys and annotation keywords the model has no field for, verbatim. */
    readonly extensions?: Readonly<Record<string, unknown>>;
}
interface StringConstraints {
    readonly format?: string;
    readonly pattern?: string;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly contentEncoding?: string;
    readonly contentMediaType?: string;
}
/** Exclusive bounds are numbers (2020-12 semantics); a 3.0 writer converts them. */
interface NumberConstraints {
    readonly format?: string;
    readonly minimum?: number;
    readonly maximum?: number;
    readonly exclusiveMinimum?: number;
    readonly exclusiveMaximum?: number;
    readonly multipleOf?: number;
}
interface Field<R> {
    readonly name: string;
    /** Optionality lives on the field, never on the shape. */
    readonly required: boolean;
    readonly shape: Shape<R>;
}
/** A JSON wire value. `null` is a union member, so `string | null` is a union. */
type Shape<R> = ({
    readonly kind: 'unknown';
} | {
    readonly kind: 'never';
} | {
    readonly kind: 'null';
} | {
    readonly kind: 'boolean';
} | ({
    readonly kind: 'string';
} & StringConstraints) | ({
    readonly kind: 'number';
    readonly integer: boolean;
} & NumberConstraints) | {
    readonly kind: 'enum';
    /** A literal is a one-member enum. Never contains `null`. */
    readonly values: readonly Literal[];
    /** Only from `x-enum-varnames` / `x-enumNames`. */
    readonly names?: readonly string[];
} | {
    readonly kind: 'array';
    readonly items: Shape<R>;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly uniqueItems?: boolean;
} | {
    readonly kind: 'tuple';
    readonly prefix: readonly Shape<R>[];
    /** Element shape after the prefix; `undefined` closes the tuple. */
    readonly rest?: Shape<R>;
    /** Set only when fewer than `prefix.length` elements are required. */
    readonly minItems?: number;
} | {
    readonly kind: 'object';
    /** In the order the schema lists them. */
    readonly fields: readonly Field<R>[];
    /** `false` closes the object, a shape types extra keys, `undefined` leaves it open. */
    readonly additional?: Shape<R> | false;
    readonly propertyNames?: Shape<R>;
    readonly minProperties?: number;
    readonly maxProperties?: number;
} | {
    readonly kind: 'union';
    readonly members: readonly Shape<R>[];
    /** `oneOf` in the source: exactly one member matches. */
    readonly exclusive: boolean;
} | {
    readonly kind: 'intersection';
    readonly members: readonly Shape<R>[];
} | {
    readonly kind: 'ref';
    readonly target: R;
}) & {
    readonly docs?: Docs;
};
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface Parameter<R> {
    readonly name: string;
    readonly in: 'path' | 'query' | 'header';
    readonly required: boolean;
    readonly shape: Shape<R>;
    /** Transport fact: object, array and tuple query values travel as JSON strings. */
    readonly encoding: 'plain' | 'json';
}
interface Example {
    readonly summary?: string;
    readonly description?: string;
    readonly value: unknown;
}
interface MediaType<R> {
    readonly shape: Shape<R>;
    readonly examples?: Readonly<Record<string, Example>>;
    /** Multipart only: part name to its content type. */
    readonly encoding?: Readonly<Record<string, {
        readonly contentType: string;
    }>>;
}
interface RequestBody<R> {
    readonly required: boolean;
    /** By media type, e.g. `application/json`, `multipart/form-data`. */
    readonly content: Readonly<Record<string, MediaType<R>>>;
}
interface ResponseHeader<R> {
    readonly name: string;
    readonly required: boolean;
    readonly shape: Shape<R>;
}
interface Response<R> {
    readonly description: string;
    readonly headers: readonly ResponseHeader<R>[];
    /** Empty for a response without a body. */
    readonly content: Readonly<Record<string, MediaType<R>>>;
}
type ResponseSlot<R> = {
    readonly kind: 'inline';
    readonly response: Response<R>;
}
/** A descriptor with an `id`, stored once in `ApiModel.responses`. */
 | {
    readonly kind: 'shared';
    readonly id: string;
};
interface SecurityRequirement {
    readonly scheme: string;
    readonly scopes: readonly string[];
}
/** OR of ANDs. `[]` is public, `[[bearer], []]` is optional auth. */
type Security = readonly (readonly SecurityRequirement[])[];
interface Server {
    readonly url: string;
    readonly description?: string;
    readonly variables?: Readonly<Record<string, {
        readonly default: string;
        readonly description?: string;
        readonly enum?: readonly string[];
    }>>;
}
interface Operation<R> {
    /** Built from the normalized path, params by position: `GET /users/{} @2024-01-01`. */
    readonly key: string;
    readonly method: HTTPMethod;
    /** The t-rest pattern, `/users/:id`; param names are data here and in `parameters`. */
    readonly path: string;
    /** The storage version; `''` in unversioned bags. */
    readonly version: string;
    readonly operationId: string;
    readonly summary?: string;
    readonly description?: string;
    readonly tags: readonly string[];
    readonly deprecated: boolean;
    readonly externalDocs?: {
        readonly url: string;
        readonly description?: string;
    };
    readonly servers?: readonly Server[];
    readonly parameters: readonly Parameter<R>[];
    readonly requestBody?: RequestBody<R>;
    /** By status code string, `'200'`, `'404'`. */
    readonly responses: Readonly<Record<string, ResponseSlot<R>>>;
    /** Always resolved: there is no "not declared" state in the model. */
    readonly security: Security;
    /** Consumer meta keys outside RouteMeta, JSON-serializable values only. */
    readonly extensions: Readonly<Record<string, unknown>>;
}

/** A pipeline type as JSON data: brands become strings, nothing is readonly. */
type Unbranded<T> = T extends ComponentName | DefKey ? string : T extends readonly (infer E)[] ? Unbranded<E>[] : T extends object ? {
    -readonly [K in keyof T as K extends ComponentName | DefKey ? string : K]: Unbranded<T[K]>;
} : T;
type ShapeDocument = Unbranded<Shape<string>>;
declare const documentSchema: z.ZodObject<{
    modelVersion: z.ZodLiteral<1>;
    versioning: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"none">;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodEnum<{
            date: "date";
            semver: "semver";
        }>;
        history: z.ZodArray<z.ZodString>;
    }, z.core.$strict>], "kind">;
    types: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"named">;
        id: z.ZodString;
        direction: z.ZodEnum<{
            input: "input";
            output: "output";
        }>;
        shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"anonymous">;
        direction: z.ZodEnum<{
            input: "input";
            output: "output";
        }>;
        shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
    }, z.core.$strict>], "kind">>;
    responses: z.ZodRecord<z.ZodString, z.ZodObject<{
        description: z.ZodString;
        headers: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            required: z.ZodBoolean;
            shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
        }, z.core.$strict>>;
        content: z.ZodRecord<z.ZodString, z.ZodObject<{
            shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
            examples: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                summary: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                value: z.ZodUnknown;
            }, z.core.$strict>>>;
            encoding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                contentType: z.ZodString;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    securitySchemes: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"http">;
        scheme: z.ZodString;
        bearerFormat: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"apiKey">;
        in: z.ZodEnum<{
            header: "header";
            query: "query";
            cookie: "cookie";
        }>;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"oauth2">;
        flows: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"openIdConnect">;
        openIdConnectUrl: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>], "type">>;
    operations: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        method: z.ZodEnum<{
            GET: "GET";
            POST: "POST";
            PUT: "PUT";
            PATCH: "PATCH";
            DELETE: "DELETE";
        }>;
        path: z.ZodString;
        version: z.ZodString;
        operationId: z.ZodString;
        summary: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        tags: z.ZodArray<z.ZodString>;
        deprecated: z.ZodBoolean;
        externalDocs: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        servers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                default: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                enum: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strict>>>;
        }, z.core.$strict>>>;
        parameters: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            in: z.ZodEnum<{
                path: "path";
                header: "header";
                query: "query";
            }>;
            required: z.ZodBoolean;
            shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
            encoding: z.ZodEnum<{
                plain: "plain";
                json: "json";
            }>;
        }, z.core.$strict>>;
        requestBody: z.ZodOptional<z.ZodObject<{
            required: z.ZodBoolean;
            content: z.ZodRecord<z.ZodString, z.ZodObject<{
                shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
                examples: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                    summary: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    value: z.ZodUnknown;
                }, z.core.$strict>>>;
                encoding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                    contentType: z.ZodString;
                }, z.core.$strict>>>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
        responses: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"inline">;
            response: z.ZodObject<{
                description: z.ZodString;
                headers: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    required: z.ZodBoolean;
                    shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
                }, z.core.$strict>>;
                content: z.ZodRecord<z.ZodString, z.ZodObject<{
                    shape: z.ZodType<ShapeDocument, unknown, z.core.$ZodTypeInternals<ShapeDocument, unknown>>;
                    examples: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                        summary: z.ZodOptional<z.ZodString>;
                        description: z.ZodOptional<z.ZodString>;
                        value: z.ZodUnknown;
                    }, z.core.$strict>>>;
                    encoding: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                        contentType: z.ZodString;
                    }, z.core.$strict>>>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"shared">;
            id: z.ZodString;
        }, z.core.$strict>], "kind">>;
        security: z.ZodArray<z.ZodArray<z.ZodObject<{
            scheme: z.ZodString;
            scopes: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>>;
        extensions: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type ApiModelDocument = z.infer<typeof documentSchema>;
declare const apiModelJsonSchema: z.core.JSONSchema.BaseSchema;
declare const parseApiModel: (json: unknown) => ApiModelDocument;

/** Where recursion without an id first sits. */
type RecursionScope = {
    /** An operation's slot, outside any named type. */
    readonly kind: 'operation';
    readonly operation: Operation<DefKey>;
    readonly slot: string;
} | {
    /** Inside the named type with this id. */
    readonly kind: 'type';
    readonly id: string;
};
/** What `naming.nameAnonymous` is asked about. */
type AnonymousContext = {
    /** An inline object at the root of a request or response body. */
    readonly kind: 'slot';
    readonly operation: Operation<DefKey>;
    readonly slot: 'body' | `response ${string}`;
    readonly contentType: string;
    readonly shape: Shape<DefKey>;
} | {
    /** Recursion without an author id; it needs a name to be referenced. */
    readonly kind: 'recursive';
    readonly scope: RecursionScope;
    /** JSON pointer from the slot or the named type. */
    readonly pointer: string;
    readonly shape: Shape<DefKey>;
};
type NameAnonymous = (context: AnonymousContext) => string | undefined;

interface NamingOptions {
    /** `reference`: an alias is a component that only refers to its target. `materialize`: a copy of the target's body. */
    readonly aliases?: 'reference' | 'materialize';
    /** Appended to the id of an input type that differs from its output. */
    readonly inputSuffix?: string;
    readonly nameAnonymous?: NameAnonymous;
}

type JsonSchemaObject = {
    readonly [keyword: string]: unknown;
};
interface JsonSchemaOptions {
    readonly target: 'draft-2020-12';
    readonly libraryOptions?: Readonly<Record<string, unknown>>;
}
/** The part of a Standard JSON Schema the reader uses. */
interface StandardJSONSchemaSource {
    readonly '~standard': {
        readonly vendor: string;
        readonly jsonSchema?: {
            readonly input: (options: JsonSchemaOptions) => JsonSchemaObject;
            readonly output: (options: JsonSchemaOptions) => JsonSchemaObject;
        };
    };
}

declare const CAPABILITIES: {
    readonly '3.0': {
        readonly openapi: "3.0.3";
        readonly nullable: "nullable-keyword";
        readonly literal: "one-value-enum";
        readonly tuple: "items-any-of";
        readonly exclusiveBounds: "boolean";
        readonly schemaExamples: "example";
        readonly refSiblings: "all-of-wrapper";
        readonly binary: "format";
        readonly propertyNames: "dropped";
        readonly annotations: "extensions-only";
    };
    readonly '3.1': {
        readonly openapi: "3.1.1";
        readonly nullable: "null-type";
        readonly literal: "const";
        readonly tuple: "prefix-items";
        readonly exclusiveBounds: "number";
        readonly schemaExamples: "examples";
        readonly refSiblings: "siblings";
        readonly binary: "content-keywords";
        readonly propertyNames: "kept";
        readonly annotations: "any-keyword";
    };
    readonly '3.2': {
        readonly openapi: "3.2.0";
        readonly nullable: "null-type";
        readonly literal: "const";
        readonly tuple: "prefix-items";
        readonly exclusiveBounds: "number";
        readonly schemaExamples: "examples";
        readonly refSiblings: "siblings";
        readonly binary: "content-keywords";
        readonly propertyNames: "kept";
        readonly annotations: "any-keyword";
    };
};
type Target = keyof typeof CAPABILITIES;

interface DocumentInfo {
    readonly title: string;
    readonly version: string;
    readonly description?: string;
    readonly contact?: {
        readonly name?: string;
        readonly url?: string;
        readonly email?: string;
    };
    readonly license?: {
        readonly name: string;
        readonly url?: string;
    };
}
interface TagObject {
    readonly name: string;
    readonly description?: string;
    readonly externalDocs?: {
        readonly url: string;
        readonly description?: string;
    };
}
type OpenAPIDocument = {
    readonly [key: string]: unknown;
};

type AnyBag = BagOfRoutes<any, any, any>;
type RoutesOf<TBag> = TBag extends BagOfRoutes<infer R, any, any> ? R : never;
/** The versions of the bag's history, `never` for an unversioned bag. */
type VersionOf<TBag> = TBag extends BagOfRoutes<any, any, infer H extends string[]> ? H[number] : never;
type MetaOf<TRoute> = TRoute extends {
    metaData: infer M;
} ? unknown extends M ? never : M : never;
type KeysOf<U> = U extends unknown ? keyof U : never;
type ValueAt<U, K extends PropertyKey> = U extends unknown ? K extends keyof U ? U[K] : undefined : never;
type MetaUnion<TBag> = MetaOf<RoutesOf<TBag>>;
/** Every key any route's `.metaData()` declares, optional: `meta.public` is `boolean | undefined`. */
type RouteMetaView<TBag> = RouteMeta & {
    readonly [K in KeysOf<MetaUnion<TBag>>]?: ValueAt<MetaUnion<TBag>, K>;
};
/** One route revision as `filter` and the `operationId` hook see it. */
interface RouteView<TBag extends AnyBag> {
    readonly method: HTTPMethod;
    /** The t-rest pattern, `/users/:id`. */
    readonly path: string;
    /** The storage version, `''` in unversioned bags. */
    readonly version: VersionOf<TBag> | '';
    /** What `.metaData()` received, `{}` without it. */
    readonly meta: RouteMetaView<TBag>;
}
type SpecVersions<TBag> = {
    /** Defaults to the newest version of a versioned bag. */
    readonly version?: VersionOf<TBag>;
    readonly versions?: never;
} | {
    /** One spec per version; `output` names where the version goes with `{version}`. */
    readonly versions: 'all' | readonly VersionOf<TBag>[];
    readonly version?: never;
};
type SpecConfig<TBag extends AnyBag> = SpecVersions<TBag> & {
    readonly target: Target;
    /** `.yaml`, `.yml` or `.json`. `{version}` is replaced with the spec version. */
    readonly output: string;
    /** Runs on every route revision before version resolution; `false` leaves it out. */
    readonly filter?: (route: RouteView<TBag>) => boolean;
};
interface OpenAPIConfig<TBag extends AnyBag> {
    readonly bag: TBag;
    /** `version` defaults to the spec version, and to `1.0.0` for an unversioned bag. */
    readonly info: Omit<DocumentInfo, 'version'> & {
        readonly version?: string;
    };
    readonly servers?: readonly Server[];
    /** Declared tags, in this order; tags only routes use follow them. */
    readonly tags?: readonly TagObject[];
    /** Schemes every spec documents, also when no route uses them. */
    readonly securitySchemes?: readonly SecurityScheme[];
    /** Security of routes without `meta.security` and without a bridged header. */
    readonly security?: SecurityRequirements;
    /** Header name to the scheme it stands for: a route declaring the header gets the scheme. */
    readonly securityFromHeaders?: Readonly<Record<string, SecurityScheme>>;
    /** Header parameters of every operation, one object schema. Route headers win. */
    readonly headers?: StandardJSONSchemaSource;
    /** Used when `meta.operationId` is absent; `undefined` falls back to the derived id. */
    readonly operationId?: (route: RouteView<TBag>) => string | undefined;
    readonly naming?: NamingOptions & {
        /** A models module (`import * as Models`): every schema in it should have an id. */
        readonly models?: Readonly<Record<string, unknown>>;
    };
    readonly vendors?: {
        /** Vendors whose `$defs` keys are ids although the vendor policy does not trust them. */
        readonly trust?: readonly string[];
    };
    /** Severity overrides for configurable diagnostics. */
    readonly diagnostics?: {
        readonly [C in ConfigurableCode]?: Severity;
    };
    readonly specs: readonly SpecConfig<TBag>[];
}
interface GeneratedSpec {
    readonly output: string;
    readonly target: Target;
    readonly document: OpenAPIDocument;
    /** The selected and pruned model this spec documents, as written to its sidecar. */
    readonly model: ApiModelDocument;
}
interface OpenAPIBuild {
    /** The named model of every route in every version. */
    readonly model: ApiModelDocument;
    readonly specs: readonly GeneratedSpec[];
    readonly diagnostics: readonly Diagnostic[];
    /**
     * Writes every spec and its `<basename>.api-model.json` sidecar, atomic per
     * file. Rejects with `OpenAPIGenerationError`, writing nothing, when a
     * diagnostic is an error.
     */
    readonly write: () => Promise<void>;
}

/**
 * Builds every spec of `config` without touching the file system: the bag is
 * read and named once, then each spec is selected from it and written for its
 * target. `write()` puts the specs and their model sidecars on disk.
 */
declare const buildOpenAPI: <TBag extends AnyBag>(config: OpenAPIConfig<TBag>) => OpenAPIBuild;

export { OpenAPIGenerationError, apiModelJsonSchema, buildOpenAPI, parseApiModel };
export type { AnonymousContext, AnyBag, ApiModelDocument, ConfigurableCode, Diagnostic, DiagnosticCode, DiagnosticData, DocumentInfo, GeneratedSpec, Location, NameAnonymous, NamingOptions, OpenAPIBuild, OpenAPIConfig, OpenAPIDocument, RouteMetaView, RouteView, Server, Severity, SpecConfig, TagObject, Target, VersionOf };
