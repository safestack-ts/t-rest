// strips the trailing slash including a lone root slash, so both parts can be concatenated
type StripTrailingSlash<TPath extends string> = TPath extends `${infer T}/`
  ? T
  : TPath

// keeps the root slash if both paths are empty or '/'
// (expressed inside the template literal so the result stays string-like for generic paths)
type JoinPathTail<
  TPath1 extends string,
  TPath2 extends string
> = `${StripTrailingSlash<TPath1>}${StripTrailingSlash<TPath2>}` extends ''
  ? '/'
  : StripTrailingSlash<TPath2>

export type JoinPath<
  TPath1 extends string,
  TPath2 extends string
> = `${StripTrailingSlash<TPath1>}${JoinPathTail<TPath1, TPath2>}`
