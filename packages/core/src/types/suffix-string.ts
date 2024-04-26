export type SuffixString<
  TString extends string,
  TSuffix extends string
> = `${TString}${TSuffix}`;
