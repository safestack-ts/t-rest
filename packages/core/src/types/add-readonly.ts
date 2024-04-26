export type AddReadonlyDeep<T> = T extends Record<PropertyKey, unknown>
  ? { +readonly [K in keyof T]: AddReadonlyDeep<T[K]> }
  : T extends Array<infer U>
  ? ReadonlyArray<AddReadonlyDeep<U>>
  : T
