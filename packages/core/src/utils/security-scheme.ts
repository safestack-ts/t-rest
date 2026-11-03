import type {
  ScopedSecurityScheme,
  SecurityScheme,
  SecuritySchemeSpec,
} from '../types/security-scheme.js'

/**
 * Declares a security scheme, `name` is its name in documentation. Routes
 * reference the returned value in `meta.security`.
 */
export const securityScheme = <
  const TName extends string,
  const TSpec extends SecuritySchemeSpec
>(
  name: TName,
  spec: TSpec
): SecurityScheme<TName, TSpec> => {
  const scheme = {
    name,
    spec,
    scopes: (...scopes: string[]): ScopedSecurityScheme => ({ scheme, scopes }),
  } as unknown as SecurityScheme<TName, TSpec>

  return scheme
}
