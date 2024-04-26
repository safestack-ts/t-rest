export type WithoutLeadingSlash<TPath extends string> =
  TPath extends `/${infer T}` ? T : TPath
export type WithoutTrailingSlash<TPath extends string> =
  TPath extends `${infer T}/` ? T : TPath
