export type RemoveReadonlyDeep<T> = T extends Record<PropertyKey, unknown>
  ? { -readonly [K in keyof T]: RemoveReadonlyDeep<T[K]> }
  : T extends readonly unknown[]
  ? RemoveReadonlyDeepArray<T>
  : T;

export type RemoveReadonlyDeepArray<Array extends readonly unknown[]> =
  Array extends readonly [infer First, ...infer Rest]
    ? [RemoveReadonlyDeep<First>, ...RemoveReadonlyDeepArray<Rest>]
    : [];
