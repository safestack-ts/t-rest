import hash from 'stable-hash'

const orderInsensitiveArrayKeys = new Set([
  'required',
  'enum',
  'oneOf',
  'anyOf',
  'allOf',
])

const isObjectRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toStableSortKey = (value: unknown) =>
  `${hash(value)}:${JSON.stringify(value)}`

const normalizeArray = (key: string, value: unknown[]) => {
  const normalized = value.map((item) => normalizeOpenAPISchema(item))

  if (orderInsensitiveArrayKeys.has(key)) {
    return [...normalized].sort((left, right) => {
      const leftSortKey = toStableSortKey(left)
      const rightSortKey = toStableSortKey(right)

      if (leftSortKey < rightSortKey) {
        return -1
      }
      if (leftSortKey > rightSortKey) {
        return 1
      }
      return 0
    })
  }

  return normalized
}

export const normalizeOpenAPISchema = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeOpenAPISchema(entry))
  }

  if (!isObjectRecord(value)) {
    return value
  }

  const normalizedEntries = Object.entries(value)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .flatMap(([key, entry]) => {
      if (entry === undefined) {
        return []
      }

      if (Array.isArray(entry)) {
        return [[key, normalizeArray(key, entry)]]
      }

      return [[key, normalizeOpenAPISchema(entry)]]
    })

  return Object.fromEntries(normalizedEntries)
}

export const hashOpenAPISchema = (value: unknown) =>
  hash(normalizeOpenAPISchema(value))

export const openAPISchemaShapeEqual = (left: unknown, right: unknown) =>
  hashOpenAPISchema(left) === hashOpenAPISchema(right)
