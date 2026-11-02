const hasToJSON = (value: object): value is { toJSON: () => unknown } =>
  typeof (value as { toJSON?: unknown }).toJSON === 'function'

const isIndexKey = (key: string) => /^\d+$/.test(key)

/**
 * Flattens multipart fields into the bracketed names that multer (through
 * append-field) parses back into arrays and objects: `tags[0]`, `meta[label]`.
 * Arrays are indexed so a single element still arrives as an array.
 *
 * - Strings, e.g. JSON text for `ze.jsonObject`, are sent as they are.
 * - `null` is sent as an empty string, the form encoding of "no value".
 * - `undefined` is left out, as are empty arrays and objects, which have no
 *   wire representation: the validator gets no value for them.
 * - Values with `toJSON` (e.g. `Date`) are sent as what it returns, other
 *   objects by their own enumerable keys, like `JSON.stringify` does.
 * - Objects whose keys are all array indices are rejected: multer would parse
 *   them back as an array.
 */
export const multipartFieldEntries = (
  fields: Record<string, unknown>
): [name: string, value: string][] => {
  const entries: [string, string][] = []

  const visit = (name: string, value: unknown) => {
    if (value === undefined) {
      return
    }

    if (value === null) {
      entries.push([name, ''])
    } else if (Buffer.isBuffer(value)) {
      entries.push([name, value.toString()])
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(`${name}[${index}]`, item))
    } else if (typeof value === 'object' && hasToJSON(value)) {
      visit(name, value.toJSON())
    } else if (typeof value === 'object') {
      const keys = Object.keys(value)

      if (keys.length > 0 && keys.every(isIndexKey)) {
        throw new TypeError(
          `The multipart field "${name}" only has numeric keys, which multer parses back as an array. Send it as JSON text instead.`
        )
      }

      for (const key of keys) {
        visit(`${name}[${key}]`, (value as Record<string, unknown>)[key])
      }
    } else {
      entries.push([name, String(value)])
    }
  }

  for (const [name, value] of Object.entries(fields)) {
    visit(name, value)
  }

  return entries
}
