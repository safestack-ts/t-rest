import type {
  ScopedSecurityScheme,
  SecurityRequirements,
  SecurityScheme,
  SecuritySchemeSpec,
} from '@t-rest/core'
import type { Field, Security } from '../model/types.js'
import type { BagModelConfig } from './config.js'

export type SchemeRef = SecurityScheme | ScopedSecurityScheme

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// The core brand is type-only, so a scheme is recognised by what `securityScheme()` returns.
export const isSecurityScheme = (value: unknown): value is SecurityScheme =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  isRecord(value.spec) &&
  typeof value.spec.type === 'string' &&
  typeof value.scopes === 'function'

export const isSchemeRef = (value: unknown): value is SchemeRef =>
  isSecurityScheme(value) ||
  (isRecord(value) &&
    isSecurityScheme(value.scheme) &&
    Array.isArray(value.scopes))

/** One alternative: every scheme of it must be satisfied. */
export type Alternative = readonly ScopedSecurityScheme[]

export interface EffectiveSecurity {
  readonly source: 'meta' | 'headers' | 'default'
  readonly alternatives: readonly Alternative[]
}

const alternativesOf = (requirements: SecurityRequirements): Alternative[] =>
  requirements.map((schemes) =>
    schemes.map((ref) =>
      isSecurityScheme(ref) ? { scheme: ref, scopes: [] } : ref
    )
  )

const sameHeader = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * `meta.security`, else the schemes bridged from the headers the validator
 * declares (a required header is `[[s]]`, an optional one `[[s], []]`), else
 * the bag default.
 */
export const effectiveSecurity = (
  declared: SecurityRequirements | undefined,
  headers: readonly Field<unknown>[],
  config: Pick<BagModelConfig, 'security' | 'securityFromHeaders'>
): EffectiveSecurity => {
  if (declared)
    return { source: 'meta', alternatives: alternativesOf(declared) }

  const bridged = Object.entries(config.securityFromHeaders ?? {}).flatMap(
    ([name, scheme]) => {
      const field = headers.find((header) => sameHeader(header.name, name))
      return field ? [{ scheme, scopes: [], required: field.required }] : []
    }
  )
  if (bridged.length === 0)
    return {
      source: 'default',
      alternatives: alternativesOf(config.security ?? []),
    }

  const required = bridged
    .filter((header) => header.required)
    .map(({ scheme, scopes }) => ({ scheme, scopes }))
  const alternatives = bridged
    .filter((header) => !header.required)
    .reduce<Alternative[]>(
      (current, { scheme, scopes }) =>
        current.flatMap((alternative) => [
          [...alternative, { scheme, scopes }],
          alternative,
        ]),
      [required]
    )
  return { source: 'headers', alternatives }
}

const specHeader = (spec: SecuritySchemeSpec): string | undefined => {
  switch (spec.type) {
    case 'apiKey':
      return spec.in === 'header' ? spec.name : undefined
    case 'http':
    case 'oauth2':
    case 'openIdConnect':
      return 'authorization'
    default:
      return undefined
  }
}

/** Lower-cased header name to the name of the scheme in effect that sends it. */
export const coveredHeaders = (
  { alternatives }: EffectiveSecurity,
  bridge: BagModelConfig['securityFromHeaders'] = {}
): ReadonlyMap<string, string> => {
  const covered = new Map<string, string>()
  for (const { scheme } of alternatives.flat()) {
    const header = specHeader(scheme.spec)
    if (header !== undefined) covered.set(header.toLowerCase(), scheme.name)
    for (const [name, bridged] of Object.entries(bridge))
      if (bridged.name === scheme.name)
        covered.set(name.toLowerCase(), scheme.name)
  }
  return covered
}

export const securityOf = ({ alternatives }: EffectiveSecurity): Security =>
  alternatives.map((alternative) =>
    alternative.map(({ scheme, scopes }) => ({ scheme: scheme.name, scopes }))
  )
