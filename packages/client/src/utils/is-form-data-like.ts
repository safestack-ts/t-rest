/**
 * Recognizes `FormData` beyond `instanceof`: the npm `form-data` package and
 * instances from another realm (e.g. jsdom) are `FormData` by tag.
 */
export const isFormDataLike = (value: unknown): boolean => {
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return true
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as { append?: unknown }).append !== 'function'
  ) {
    return false
  }

  return (
    Object.prototype.toString.call(value) === '[object FormData]' ||
    String(value) === '[object FormData]'
  )
}
