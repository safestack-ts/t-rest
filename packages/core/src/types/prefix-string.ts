export type PrefixString<
  TString extends string,
  TPrefix extends string
> = `${TPrefix}${TString}`
