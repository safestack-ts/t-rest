import type { SecurityRequirements } from './security-scheme.js'

/**
 * The documented meta data of a route. `.metaData()` checks these keys and
 * keeps any other key with its own type, e.g. `public: true` for a filter.
 */
export interface RouteMeta {
  readonly summary?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly deprecated?: boolean
  readonly operationId?: string
  readonly externalDocs?: {
    readonly url: string
    readonly description?: string
  }
  readonly servers?: readonly {
    readonly url: string
    readonly description?: string
    readonly variables?: Readonly<
      Record<
        string,
        {
          readonly default: string
          readonly description?: string
          readonly enum?: readonly string[]
        }
      >
    >
  }[]
  readonly security?: SecurityRequirements
}

/** Checks the keys of `RouteMeta` in a meta data type, other keys pass as they are. */
export type CheckMeta<TMeta> = {
  [TKey in keyof TMeta]: TKey extends keyof RouteMeta
    ? RouteMeta[TKey]
    : unknown
}
