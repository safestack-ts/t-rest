export type WithoutLeadingSlash<TPath extends string> =
  TPath extends `/${infer T}` ? T : TPath
// keeps the root path '/' intact, mirroring the runtime joinPath
export type WithoutTrailingSlash<TPath extends string> = TPath extends '/'
  ? TPath
  : TPath extends `${infer T}/`
  ? T
  : TPath
