// The canonical, format-neutral API model. Nothing here is OpenAPI: no
// `nullable`, no `components`, no `$ref` strings, no parameter styles.
// `ApiModel<R>` is generic over how a shape refers to a named type:
//   ApiModel<DefKey>         what the reader and the route stage build
//   ApiModel<ComponentName>  what naming produces and the writer consumes
// The serialized `ApiModelDocument` (document-schema.ts) is the same model with
// plain strings, checked by document-schema.type.test.ts.

import type { ModelVersion } from './version-history.js'

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export type Direction = 'input' | 'output'

/**
 * Identity of a type inside one generator run:
 * `input:<id>` / `output:<id>` for author ids, and
 * `anon:<operation key>#<slot>#<json pointer>` for recursion without an id.
 */
export type DefKey = Brand<string, 'DefKey'>

/** Minted only by naming; the writer accepts nothing else. */
export type ComponentName = Brand<string, 'ComponentName'>

export type Literal = string | number | boolean

export interface Docs {
  readonly title?: string
  readonly description?: string
  readonly examples?: readonly unknown[]
  readonly default?: unknown
  readonly deprecated?: boolean
  readonly readOnly?: boolean
  readonly writeOnly?: boolean
  /** `x-*` keys and annotation keywords the model has no field for, verbatim. */
  readonly extensions?: Readonly<Record<string, unknown>>
}

export interface StringConstraints {
  readonly format?: string
  readonly pattern?: string
  readonly minLength?: number
  readonly maxLength?: number
  readonly contentEncoding?: string
  readonly contentMediaType?: string
}

/** Exclusive bounds are numbers (2020-12 semantics); a 3.0 writer converts them. */
export interface NumberConstraints {
  readonly format?: string
  readonly minimum?: number
  readonly maximum?: number
  readonly exclusiveMinimum?: number
  readonly exclusiveMaximum?: number
  readonly multipleOf?: number
}

export interface Field<R> {
  readonly name: string
  /** Optionality lives on the field, never on the shape. */
  readonly required: boolean
  readonly shape: Shape<R>
}

/** A JSON wire value. `null` is a union member, so `string | null` is a union. */
export type Shape<R> = (
  | { readonly kind: 'unknown' }
  | { readonly kind: 'never' }
  | { readonly kind: 'null' }
  | { readonly kind: 'boolean' }
  | ({ readonly kind: 'string' } & StringConstraints)
  | ({ readonly kind: 'number'; readonly integer: boolean } & NumberConstraints)
  | {
      readonly kind: 'enum'
      /** A literal is a one-member enum. Never contains `null`. */
      readonly values: readonly Literal[]
      /** Only from `x-enum-varnames` / `x-enumNames`. */
      readonly names?: readonly string[]
    }
  | {
      readonly kind: 'array'
      readonly items: Shape<R>
      readonly minItems?: number
      readonly maxItems?: number
      readonly uniqueItems?: boolean
    }
  | {
      readonly kind: 'tuple'
      readonly prefix: readonly Shape<R>[]
      /** Element shape after the prefix; `undefined` closes the tuple. */
      readonly rest?: Shape<R>
      /** Set only when fewer than `prefix.length` elements are required. */
      readonly minItems?: number
    }
  | {
      readonly kind: 'object'
      /** In the order the schema lists them. */
      readonly fields: readonly Field<R>[]
      /** `false` closes the object, a shape types extra keys, `undefined` leaves it open. */
      readonly additional?: Shape<R> | false
      readonly propertyNames?: Shape<R>
      readonly minProperties?: number
      readonly maxProperties?: number
    }
  | {
      readonly kind: 'union'
      readonly members: readonly Shape<R>[]
      /** `oneOf` in the source: exactly one member matches. */
      readonly exclusive: boolean
    }
  | { readonly kind: 'intersection'; readonly members: readonly Shape<R>[] }
  | { readonly kind: 'ref'; readonly target: R }
) & { readonly docs?: Docs }

export type ShapeKind = Shape<unknown>['kind']

export type TypeDef<R> = {
  readonly direction: Direction
  readonly shape: Shape<R>
} & (
  | { readonly kind: 'named'; readonly id: string }
  /** Recursion without an author id; naming must name it. */
  | { readonly kind: 'anonymous' }
)

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface Parameter<R> {
  readonly name: string
  readonly in: 'path' | 'query' | 'header'
  readonly required: boolean
  readonly shape: Shape<R>
  /** Transport fact: object, array and tuple query values travel as JSON strings. */
  readonly encoding: 'plain' | 'json'
}

export interface Example {
  readonly summary?: string
  readonly description?: string
  readonly value: unknown
}

export interface MediaType<R> {
  readonly shape: Shape<R>
  readonly examples?: Readonly<Record<string, Example>>
  /** Multipart only: part name to its content type. */
  readonly encoding?: Readonly<Record<string, { readonly contentType: string }>>
}

export interface RequestBody<R> {
  readonly required: boolean
  /** By media type, e.g. `application/json`, `multipart/form-data`. */
  readonly content: Readonly<Record<string, MediaType<R>>>
}

export interface ResponseHeader<R> {
  readonly name: string
  readonly required: boolean
  readonly shape: Shape<R>
}

export interface Response<R> {
  readonly description: string
  readonly headers: readonly ResponseHeader<R>[]
  /** Empty for a response without a body. */
  readonly content: Readonly<Record<string, MediaType<R>>>
}

export type ResponseSlot<R> =
  | { readonly kind: 'inline'; readonly response: Response<R> }
  /** A descriptor with an `id`, stored once in `ApiModel.responses`. */
  | { readonly kind: 'shared'; readonly id: string }

export interface SecurityRequirement {
  readonly scheme: string
  readonly scopes: readonly string[]
}

/** OR of ANDs. `[]` is public, `[[bearer], []]` is optional auth. */
export type Security = readonly (readonly SecurityRequirement[])[]

export interface Operation<R> {
  /** Built from the normalized path, params by position: `GET /users/{} @2024-01-01`. */
  readonly key: string
  readonly method: HTTPMethod
  /** The t-rest pattern, `/users/:id`; param names are data here and in `parameters`. */
  readonly path: string
  /** The storage version; `''` in unversioned bags. */
  readonly version: string
  readonly operationId: string
  readonly summary?: string
  readonly description?: string
  readonly tags: readonly string[]
  readonly deprecated: boolean
  readonly externalDocs?: {
    readonly url: string
    readonly description?: string
  }
  readonly servers?: readonly {
    readonly url: string
    readonly description?: string
  }[]
  readonly parameters: readonly Parameter<R>[]
  readonly requestBody?: RequestBody<R>
  /** By status code string, `'200'`, `'404'`. */
  readonly responses: Readonly<Record<string, ResponseSlot<R>>>
  /** Always resolved: there is no "not declared" state in the model. */
  readonly security: Security
  /** Consumer meta keys outside RouteMeta, JSON-serializable values only. */
  readonly extensions: Readonly<Record<string, unknown>>
}

export type Versioning =
  | { readonly kind: 'none' }
  | { readonly kind: 'date' | 'semver'; readonly history: readonly string[] }

export type SecuritySchemeModel = { readonly description?: string } & (
  | {
      readonly type: 'http'
      readonly scheme: string
      readonly bearerFormat?: string
    }
  | {
      readonly type: 'apiKey'
      readonly in: 'header' | 'query' | 'cookie'
      readonly name: string
    }
  | {
      readonly type: 'oauth2'
      readonly flows: Readonly<Record<string, unknown>>
    }
  | { readonly type: 'openIdConnect'; readonly openIdConnectUrl: string }
)

export interface ApiModel<R extends string> {
  readonly modelVersion: ModelVersion
  readonly versioning: Versioning
  readonly types: Readonly<Record<R, TypeDef<R>>>
  readonly responses: Readonly<Record<string, Response<R>>>
  readonly securitySchemes: Readonly<Record<string, SecuritySchemeModel>>
  /** Sorted by key. */
  readonly operations: readonly Operation<R>[]
}
