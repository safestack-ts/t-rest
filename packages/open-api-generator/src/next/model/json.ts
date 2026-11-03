const isPlainObject = (value: object) => {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** What JSON cannot carry in `value`, e.g. `function` or `Date`; `undefined` for JSON values. */
export const nonJsonType = (value: unknown): string | undefined => {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return undefined
    case 'number':
      return Number.isFinite(value) ? undefined : String(value)
    case 'object':
      if (value === null) return undefined
      if (Array.isArray(value))
        return value.map(nonJsonType).find((type) => type !== undefined)
      if (!isPlainObject(value)) return value.constructor?.name ?? 'object'
      return Object.values(value)
        .map(nonJsonType)
        .find((type) => type !== undefined)
    default:
      return typeof value
  }
}

/** JSON with object keys sorted, so structurally equal values give equal strings. */
export const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_, nested: unknown) =>
    typeof nested === 'object' && nested !== null && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : 1))
        )
      : nested
  )
