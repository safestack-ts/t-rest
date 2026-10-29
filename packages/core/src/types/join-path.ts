import { WithoutTrailingSlash } from './without-slash.js'

// keeps the root slash if both paths are empty or '/'
// (expressed inside the template literal so the result stays string-like for generic paths)
type JoinPathTail<
  TPath1 extends string,
  TPath2 extends string
> = `${WithoutTrailingSlash<TPath1>}${WithoutTrailingSlash<TPath2>}` extends ''
  ? '/'
  : WithoutTrailingSlash<TPath2>

export type JoinPath<
  TPath1 extends string,
  TPath2 extends string
> = `${WithoutTrailingSlash<TPath1>}${JoinPathTail<TPath1, TPath2>}`
