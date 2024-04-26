import { WithoutTrailingSlash } from "./without-slash";

export type JoinPath<
  TPath1 extends string,
  TPath2 extends string
> = `${WithoutTrailingSlash<TPath1>}${WithoutTrailingSlash<TPath2>}`;
