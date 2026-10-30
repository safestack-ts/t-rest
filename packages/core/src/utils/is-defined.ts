/** @deprecated Internal helper, will be removed from the public API in a future major. */
export function isDefined<Value>(
  value: Value | null | undefined
): value is Value {
  return value !== null && value !== undefined
}
