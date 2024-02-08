export type NonEmptyArray<Type> = [Type, ...Type[]];

export const isNonEmptyArray = <T>(arr: T[]): arr is NonEmptyArray<T> =>
  arr.length > 0;

export const first = <T>(arr: NonEmptyArray<T>): T => arr[0];
export const last = <T>(arr: NonEmptyArray<T>): T => arr[arr.length - 1];
