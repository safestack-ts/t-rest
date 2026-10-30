/** @deprecated Internal helper, will be removed from the public API in a future major. */
export const typedLowerCase = <T extends string>(str: T): Lowercase<T> =>
  str.toLowerCase() as Lowercase<T>

/** @deprecated Internal helper, will be removed from the public API in a future major. */
export const typedUpperCase = <T extends string>(str: T): Uppercase<T> =>
  str.toUpperCase() as Uppercase<T>
