export type WithoutDoubleSlash<TPath extends string> =
  TPath extends `${infer T}//${infer U}`
    ? WithoutDoubleSlash<`${T}/${U}`>
    : TPath
