export type NonEmptyArray<Type> = [Type, ...Type[]]

/** @deprecated Internal helper, will be removed from the public API in a future major. */
export const isNonEmptyArray = <T>(arr: T[]): arr is NonEmptyArray<T> =>
  arr.length > 0

/** @deprecated Internal helper, will be removed from the public API in a future major. */
export const first = <T>(arr: NonEmptyArray<T>): T => arr[0]
/** @deprecated Internal helper, will be removed from the public API in a future major. */
export const last = <T>(arr: NonEmptyArray<T>): T => arr[arr.length - 1]
