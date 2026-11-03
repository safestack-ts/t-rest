import type {
  BagOfRoutes,
  RouteMeta,
  SecurityRequirements,
  SecurityScheme,
} from '@t-rest/core'
import type {
  ConfigurableCode,
  Diagnostic,
  Severity,
} from '../diagnostics/registry.js'
import type { ApiModelDocument } from '../model/document-schema.js'
import type { HTTPMethod, Server } from '../model/types.js'
import type { NamingOptions } from '../naming/assign-names.js'
import type { StandardJSONSchemaSource } from '../reader/convert.js'
import type { Target } from '../writer/capabilities.js'
import type {
  DocumentInfo,
  OpenAPIDocument,
  TagObject,
} from '../writer/document.js'

export type AnyBag = BagOfRoutes<any, any, any>

type RoutesOf<TBag> = TBag extends BagOfRoutes<infer R, any, any> ? R : never

/** The versions of the bag's history, `never` for an unversioned bag. */
export type VersionOf<TBag> = TBag extends BagOfRoutes<
  any,
  any,
  infer H extends string[]
>
  ? H[number]
  : never

// routes without `.metaData()` have `unknown` meta, which would swallow the union
type MetaOf<TRoute> = TRoute extends { metaData: infer M }
  ? unknown extends M
    ? never
    : M
  : never
type KeysOf<U> = U extends unknown ? keyof U : never
type ValueAt<U, K extends PropertyKey> = U extends unknown
  ? K extends keyof U
    ? U[K]
    : undefined
  : never
type MetaUnion<TBag> = MetaOf<RoutesOf<TBag>>

/** Every key any route's `.metaData()` declares, optional: `meta.public` is `boolean | undefined`. */
export type RouteMetaView<TBag> = RouteMeta & {
  readonly [K in KeysOf<MetaUnion<TBag>>]?: ValueAt<MetaUnion<TBag>, K>
}

/** One route revision as `filter` and the `operationId` hook see it. */
export interface RouteView<TBag extends AnyBag> {
  readonly method: HTTPMethod
  /** The t-rest pattern, `/users/:id`. */
  readonly path: string
  /** The storage version, `''` in unversioned bags. */
  readonly version: VersionOf<TBag> | ''
  /** What `.metaData()` received, `{}` without it. */
  readonly meta: RouteMetaView<TBag>
}

type SpecVersions<TBag> =
  | {
      /** Defaults to the newest version of a versioned bag. */
      readonly version?: VersionOf<TBag>
      readonly versions?: never
    }
  | {
      /** One spec per version; `output` names where the version goes with `{version}`. */
      readonly versions: 'all' | readonly VersionOf<TBag>[]
      readonly version?: never
    }

export type SpecConfig<TBag extends AnyBag> = SpecVersions<TBag> & {
  readonly target: Target
  /** `.yaml`, `.yml` or `.json`. `{version}` is replaced with the spec version. */
  readonly output: string
  /** Runs on every route revision before version resolution; `false` leaves it out. */
  readonly filter?: (route: RouteView<TBag>) => boolean
}

export interface OpenAPIConfig<TBag extends AnyBag> {
  readonly bag: TBag
  /** `version` defaults to the spec version, and to `1.0.0` for an unversioned bag. */
  readonly info: Omit<DocumentInfo, 'version'> & { readonly version?: string }
  readonly servers?: readonly Server[]
  /** Declared tags, in this order; tags only routes use follow them. */
  readonly tags?: readonly TagObject[]
  /** Schemes every spec documents, also when no route uses them. */
  readonly securitySchemes?: readonly SecurityScheme[]
  /** Security of routes without `meta.security` and without a bridged header. */
  readonly security?: SecurityRequirements
  /** Header name to the scheme it stands for: a route declaring the header gets the scheme. */
  readonly securityFromHeaders?: Readonly<Record<string, SecurityScheme>>
  /** Header parameters of every operation, one object schema. Route headers win. */
  readonly headers?: StandardJSONSchemaSource
  /** Used when `meta.operationId` is absent; `undefined` falls back to the derived id. */
  readonly operationId?: (route: RouteView<TBag>) => string | undefined
  readonly naming?: NamingOptions & {
    /** A models module (`import * as Models`): every schema in it should have an id. */
    readonly models?: Readonly<Record<string, unknown>>
  }
  readonly vendors?: {
    /** Vendors whose `$defs` keys are ids although the vendor policy does not trust them. */
    readonly trust?: readonly string[]
  }
  /** Severity overrides for configurable diagnostics. */
  readonly diagnostics?: { readonly [C in ConfigurableCode]?: Severity }
  readonly specs: readonly SpecConfig<TBag>[]
}

export interface GeneratedSpec {
  readonly output: string
  readonly target: Target
  readonly document: OpenAPIDocument
  /** The selected and pruned model this spec documents, as written to its sidecar. */
  readonly model: ApiModelDocument
}

export interface OpenAPIBuild {
  /** The named model of every route in every version. */
  readonly model: ApiModelDocument
  readonly specs: readonly GeneratedSpec[]
  readonly diagnostics: readonly Diagnostic[]
  /**
   * Writes every spec and its `<basename>.api-model.json` sidecar, atomic per
   * file. Rejects with `OpenAPIGenerationError`, writing nothing, when a
   * diagnostic is an error.
   */
  readonly write: () => Promise<void>
}
