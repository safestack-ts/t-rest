export type VersionConvention = { kind: 'header'; name: string }

/** Declares that the api version travels in the header `name`. */
export const versionHeader = (name: string): VersionConvention => ({
  kind: 'header',
  name,
})

type HeaderSource = Record<string, unknown> | ((name: string) => unknown)

const toVersion = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value

  return typeof first === 'string' ? first : undefined
}

/**
 * Reads the requested version. Headers are either an object (looked up by the
 * lower-cased header name, then by the name as declared) or a getter function.
 */
export const readVersion = (
  convention: VersionConvention,
  headers: HeaderSource
): string | undefined => {
  if (typeof headers === 'function') {
    return toVersion(headers(convention.name))
  }

  return toVersion(
    headers[convention.name.toLowerCase()] ?? headers[convention.name]
  )
}

/** Returns new headers with the version set, replacing any existing value of the header. */
export const writeVersion = <THeaderValue>(
  convention: VersionConvention,
  headers: Record<string, THeaderValue>,
  version: string
): Record<string, THeaderValue | string> => {
  const name = convention.name.toLowerCase()
  const others = Object.entries(headers).filter(
    ([key]) => key.toLowerCase() !== name
  )

  return { ...Object.fromEntries(others), [convention.name]: version }
}
