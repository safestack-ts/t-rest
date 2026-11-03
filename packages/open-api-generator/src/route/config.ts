import type { SecurityRequirements, SecurityScheme } from '@t-rest/core'
import type { HTTPMethod } from '../model/types.js'
import type { StandardJSONSchemaSource } from '../reader/convert.js'

/** One route revision as `filter` and the `operationId` hook see it. */
export interface RouteView {
  readonly method: HTTPMethod
  /** The t-rest pattern, `/users/:id`. */
  readonly path: string
  /** The storage version; `''` in unversioned bags. */
  readonly version: string
  /** What `.metaData()` received, `null` without it. */
  readonly meta: unknown
}

export interface BagModelConfig {
  /** Header parameters of every operation, one object schema read as input. Route headers win. */
  readonly headers?: StandardJSONSchemaSource
  /** Security of routes without `meta.security` and without a bridged header. */
  readonly security?: SecurityRequirements
  /** Schemes documented even when no route uses them. */
  readonly securitySchemes?: readonly SecurityScheme[]
  /** Header name to the scheme a declared header of that name stands for. */
  readonly securityFromHeaders?: Readonly<Record<string, SecurityScheme>>
  /** Used when `meta.operationId` is absent; `undefined` falls back to the derived id. */
  readonly operationId?: (route: RouteView) => string | undefined
  readonly vendors?: { readonly trust?: readonly string[] }
}
