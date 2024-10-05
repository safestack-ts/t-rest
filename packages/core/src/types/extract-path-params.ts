export type ExtractPathParams<T extends string> = string extends T
  ? Record<string, string>
  : T extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? { [k in Param | keyof ExtractPathParams<Rest>]: string | number }
  : T extends `${infer _Start}:${infer Param}`
  ? { [k in Param]: string | number }
  : {}
