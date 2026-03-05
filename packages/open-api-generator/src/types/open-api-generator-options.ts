export type OpenAPIGeneratorOptions = {
  includeTypesNamespaceInName?: boolean
}

export type ResolvedOpenAPIGeneratorOptions = {
  includeTypesNamespaceInName: boolean
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
