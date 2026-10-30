export type RouteNamingContextInput = {
  method: string
  path: string
  version: string
  // whether the naming context is derived for the validator input or the response
  kind: 'input' | 'response'
  // naming contexts found in the explicitly written types of the route
  namingContext: {
    input?: string
    response?: string
  }
}

export type CanonicalTypeOwnershipOptions = {
  /**
   * Matches the namespace paths that may own public types, e.g. `V2024_01_01.Customer.Checkout`.
   * The named groups `version` and `audience` identify the version and audience of a namespace.
   * Versions are compared lexicographically, so the earliest version is the canonical owner.
   */
  namespacePattern: RegExp
  /**
   * Audience whose owners are used for every other audience that does not re-export a type itself.
   */
  sharedAudience?: string
  /**
   * Named types without a public owner are named after the namespace of the route (or enclosing type)
   * that uses them, instead of their plain name.
   */
  inheritRouteNamespaceForUnownedTypes?: boolean
  /**
   * Matches the file names of modules whose types are always named after the namespace of the route
   * that uses them, e.g. generic query helpers shared by many routes.
   */
  routeScopedTypeModules?: RegExp
}

export type OpenAPIGeneratorOptions = {
  includeTypesNamespaceInName?: boolean
  /**
   * Names re-exported public types after a single canonical owner. Requires `includeTypesNamespaceInName`.
   */
  canonicalTypeOwnership?: CanonicalTypeOwnershipOptions
  /**
   * Naming context (namespace path, e.g. `V2024_01_01.Admin.Order`) of a route input or response
   * whose route definition does not reference a namespaced type explicitly.
   */
  deriveRouteNamingContext?: (
    route: RouteNamingContextInput
  ) => string | undefined
}

export type ResolvedOpenAPIGeneratorOptions = {
  includeTypesNamespaceInName: boolean
  canonicalTypeOwnership?: CanonicalTypeOwnershipOptions
  deriveRouteNamingContext?: (
    route: RouteNamingContextInput
  ) => string | undefined
}

const defaultOpenAPIGeneratorOptions: ResolvedOpenAPIGeneratorOptions = {
  includeTypesNamespaceInName: false,
}

export const resolveOpenAPIGeneratorOptions = (
  options?: OpenAPIGeneratorOptions
): ResolvedOpenAPIGeneratorOptions => ({
  ...defaultOpenAPIGeneratorOptions,
  ...options,
})
