import { resolveDateVersion, resolveVersion, Versioning } from '@t-rest/core'
import { VersionExtractor } from '../types/version-extractor.js'
import { isDateVersionExtractor } from '../utils/is-date-version-extractor.js'

// how versions are interpreted at request time, decided once per router
export type VersionPolicy =
  | { readonly kind: 'unversioned' }
  | {
      readonly kind: 'ordered'
      readonly history: readonly string[]
      // only set if the extractor is a DateVersionExtractor, which switches
      // resolution to date interpolation
      readonly parseDate: ((version: string) => Date) | null
    }

export type Resolution =
  | { readonly kind: 'unversioned' }
  | {
      readonly kind: 'resolved'
      readonly requested: string
      readonly resolved: string
    }
  | { readonly kind: 'missing' }
  | { readonly kind: 'incompatible'; readonly requested: string }

export const policyFrom = (
  versioning: Versioning,
  history: readonly string[],
  extractor: VersionExtractor
): VersionPolicy =>
  versioning === Versioning.NO_VERSIONING
    ? { kind: 'unversioned' }
    : {
        kind: 'ordered',
        history,
        parseDate: isDateVersionExtractor(extractor)
          ? extractor.parseDate.bind(extractor)
          : null,
      }

// `requested` is the version of the request already falling back to the latest
// version of the history, an empty version counts as missing
export const resolveRequest = (
  policy: VersionPolicy,
  requested: string | undefined | null,
  handledVersions: readonly string[]
): Resolution => {
  if (policy.kind === 'unversioned') {
    return { kind: 'unversioned' }
  }

  if (!requested) {
    return { kind: 'missing' }
  }

  // core resolves on mutable arrays without modifying them
  const history = policy.history as string[]
  const available = handledVersions as string[]

  const resolved = policy.parseDate
    ? resolveDateVersion(history, available, requested, policy.parseDate)
    : resolveVersion(history, available, requested)

  return resolved === null
    ? { kind: 'incompatible', requested }
    : { kind: 'resolved', requested, resolved }
}
