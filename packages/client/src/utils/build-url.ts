type RequestInputWithQuery = {
  query: Record<string, unknown>
}

type RequestInputWithParams = {
  params: Record<string, unknown>
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

const stringifyQuery = (query: Record<string, unknown> | undefined) => {
  if (!query) return ''

  const stringifiedQueryValues = Object.fromEntries(
    Object.entries(query).map(([key, value]) => {
      if (typeof value === 'object') {
        if (isObjectWithToJSON(value)) {
          return [key, value.toJSON()]
        } else {
          return [key, JSON.stringify(value)]
        }
      } else {
        return [key, String(value)]
      }
    })
  )

  const searchQuery = new URLSearchParams(stringifiedQueryValues)

  return searchQuery.toString()
}

const replaceParams = (
  path: string,
  params: Record<string, unknown> = {}
): string => {
  let replacedPath = path

  for (const [key, value] of Object.entries(params)) {
    replacedPath = replacedPath.replace(`:${key}`, String(value))
  }

  return replacedPath
}

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
