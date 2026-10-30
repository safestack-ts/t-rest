type RequestInputWithQuery = {
  query: unknown
}

type RequestInputWithParams = {
  params: unknown
}

type RequestInputWithBody = {
  body: unknown
}

export type BaseRequestInput = Partial<RequestInputWithQuery> &
  Partial<RequestInputWithParams> &
  Partial<RequestInputWithBody>

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
 * Serializes a query object into a URL search string.
 *
 * - `undefined` and `null` values are omitted.
 * - Objects with a `toJSON` method (e.g. `Date`) are serialized via `toJSON()`,
 *   other objects and arrays as JSON strings (`ids=[1,2]`), which servers
 *   parse back with a JSON query validator (e.g. `ze.jsonObject`). An empty
 *   array is kept as `[]`.
 * - Everything else is serialized via `String(value)`.
 */
const stringifyQuery = (query: unknown | undefined) => {
  if (!query) return ''

  const searchQuery = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue

    searchQuery.append(key, stringifyQueryValue(value))
  }

  return searchQuery.toString()
}

/**
 * Replaces every `:name` placeholder in `path` whose name is a key of `params`
 * with the URL-encoded param value. Placeholders are matched by their whole
 * name, so `:id` never matches inside `:idx`.
 */
const replaceParams = (
  path: string,
  params: Record<string, unknown> = {}
): string =>
  path.replace(/:(\w+)/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? encodeURIComponent(String(params[key]))
      : placeholder
  )

const isRequestWithParams = <TRequest extends BaseRequestInput>(
  obj: TRequest
): obj is TRequest & RequestInputWithParams => 'params' in obj

export const buildUrl = (path: string, request?: BaseRequestInput): string => {
  if (!request) return path

  const urlWithParams = isRequestWithParams(request)
    ? replaceParams(path, request.params as Record<string, unknown>)
    : path
  const stringifiedQuery = stringifyQuery(request.query)

  return `${urlWithParams}${stringifiedQuery ? `?${stringifiedQuery}` : ''}`
}
