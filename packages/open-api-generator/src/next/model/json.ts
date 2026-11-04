const isPlainObject = (value: object) => {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * What JSON cannot carry in `value`, e.g. `function`, `Date` or `cyclic value`;
 * `undefined` for JSON values. `ancestors` are the objects enclosing `value`.
 */
export const nonJsonType = (
  value: unknown,
  ancestors: ReadonlySet<object> = new Set()
): string | undefined => {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return undefined
    case 'number':
      return Number.isFinite(value) ? undefined : String(value)
    case 'object': {
      if (value === null) return undefined
      if (ancestors.has(value)) return 'cyclic value'
      if (!Array.isArray(value) && !isPlainObject(value))
        return value.constructor?.name ?? 'object'
      const enclosing = new Set(ancestors).add(value)
      return Object.values(value)
        .map((nested) => nonJsonType(nested, enclosing))
        .find((type) => type !== undefined)
    }
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
