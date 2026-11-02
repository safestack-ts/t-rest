const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const toFieldValue = (value: unknown): string | Buffer =>
  typeof value === 'string' || Buffer.isBuffer(value)
    ? value
    : value instanceof Date
    ? value.toISOString()
    : String(value)

/**
 * Flattens multipart fields into the bracketed names that multer (through
 * append-field) parses back into arrays and objects: `tags[0]`, `meta[label]`.
 * Arrays are indexed so a single element still arrives as an array. Strings,
 * e.g. JSON text for `ze.jsonObject`, are sent as they are. `undefined` and
 * `null` have no wire representation and are left out, as are empty arrays
 * and objects.
 */
export const multipartFieldEntries = (
  fields: Record<string, unknown>
): [name: string, value: string | Buffer][] => {
  const entries: [string, string | Buffer][] = []

  const visit = (name: string, value: unknown) => {
    if (value === undefined || value === null) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(`${name}[${index}]`, item))
    } else if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        visit(`${name}[${key}]`, item)
      }
    } else {
      entries.push([name, toFieldValue(value)])
    }
  }

  for (const [name, value] of Object.entries(fields)) {
    visit(name, value)
  }

  return entries
}
