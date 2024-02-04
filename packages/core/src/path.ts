export type WithoutLeadingSlash<TPath extends string> =
  TPath extends `/${infer T}` ? T : TPath;
export type WithoutTrailingSlash<TPath extends string> =
  TPath extends `${infer T}/` ? T : TPath;

export type JoinPath<
  TPath1 extends string,
  TPath2 extends string
> = `${WithoutTrailingSlash<TPath1>}${WithoutTrailingSlash<TPath2>}`;

export const joinPath = (prefix: string, path: string) =>
  `/${prefix}/${path}`.replace(/(?<!:)\/{2,}/g, "/");

// @todo transform into type tests
type A = JoinPath<"/", "/a">; // '/b'
type B = JoinPath<"/a", "/b">; // '/a/b'
type C = JoinPath<"/a/", "/b">; // '/a/b'
type D = JoinPath<"/a", "/b/">; // '/a/b'
