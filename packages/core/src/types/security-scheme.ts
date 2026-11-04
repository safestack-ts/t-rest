declare const securitySchemeBrand: unique symbol

interface OAuthFlow {
  readonly refreshUrl?: string
  /** Scope name to its description. */
  readonly scopes: Readonly<Record<string, string>>
}

export interface OAuthFlows {
  readonly authorizationCode?: OAuthFlow & {
    readonly authorizationUrl: string
    readonly tokenUrl: string
  }
  readonly clientCredentials?: OAuthFlow & { readonly tokenUrl: string }
  readonly implicit?: OAuthFlow & { readonly authorizationUrl: string }
  readonly password?: OAuthFlow & { readonly tokenUrl: string }
}

/** How a client authenticates, in the vocabulary of OpenAPI security schemes. */
export type SecuritySchemeSpec = { readonly description?: string } & (
  | {
      readonly type: 'http'
      readonly scheme: 'bearer'
      readonly bearerFormat?: string
    }
  | { readonly type: 'http'; readonly scheme: 'basic' }
  | {
      readonly type: 'apiKey'
      readonly in: 'header' | 'query' | 'cookie'
      readonly name: string
    }
  | { readonly type: 'oauth2'; readonly flows: OAuthFlows }
  | { readonly type: 'openIdConnect'; readonly openIdConnectUrl: string }
)

/** The scope names an oauth2 scheme declares in any of its flows. */
export type SecuritySchemeScope<TSpec extends SecuritySchemeSpec> =
  TSpec extends { readonly type: 'oauth2'; readonly flows: infer TFlows }
    ? {
        [TFlow in keyof TFlows]-?: TFlows[TFlow] extends {
          readonly scopes: infer TScopes
        }
          ? keyof TScopes & string
          : never
      }[keyof TFlows]
    : never

/** A security scheme requested with scopes. */
export interface ScopedSecurityScheme {
  readonly scheme: SecurityScheme
  readonly scopes: readonly string[]
}

/** Created by `securityScheme()`, routes reference it in `meta.security`. */
export interface SecurityScheme<
  TName extends string = string,
  TSpec extends SecuritySchemeSpec = SecuritySchemeSpec
> {
  readonly [securitySchemeBrand]: true
  readonly name: TName
  readonly spec: TSpec
  scopes(...scopes: SecuritySchemeScope<TSpec>[]): ScopedSecurityScheme
}

/**
 * Alternatives of requirements, each satisfied by all of its schemes. `[]` is
 * public, `[[bearer], []]` makes authentication optional.
 */
export type SecurityRequirements = readonly (readonly (
  | SecurityScheme
  | ScopedSecurityScheme
)[])[]
