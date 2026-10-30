const isObjectWithToJSON = <T>(obj: T): obj is T & { toJSON: () => string } =>
  typeof obj === 'object' &&
  'toJSON' in Object(obj) &&
  typeof (obj as any)['toJSON'] === 'function'

const stringifyQueryValue = (value: unknown): string => {
  if (typeof value === 'object' && value !== null) {
    return isObjectWithToJSON(value) ? value.toJSON() : JSON.stringify(value)
  }

  return String(value)
}

/**
 * Serializes a query object into a URL search string (without the leading `?`).
 *
 * - `undefined` and `null` values are omitted.
 * - Objects with a `toJSON` method (e.g. `Date`) are serialized via `toJSON()`,
 *   other objects and arrays as JSON strings (`ids=[1,2]`), which servers
 *   parse back with a JSON query validator (e.g. `ze.jsonObject`). An empty
 *   array is kept as `[]`.
 * - Everything else is serialized via `String(value)`.
 */
export const encodeQuery = (query: unknown | undefined): string => {
  if (!query) return ''

  const searchQuery = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue

    searchQuery.append(key, stringifyQueryValue(value))
  }

  return searchQuery.toString()
}

/**
 * Inverse of the structured values of `encodeQuery`: parses a JSON string.
 * Returns the input unchanged if it is not a string or not valid JSON.
 */
export const decodeStructuredQueryValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
