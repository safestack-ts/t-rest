export type PrefixString<
  TString extends string,
  TPrefix extends string
> = `${TPrefix}${TString}`;

export type SuffixString<
  TString extends string,
  TSuffix extends string
> = `${TString}${TSuffix}`;

export type StringStartsWith<
  TString extends string,
  TStart extends string
> = TString extends `${TStart}${infer _Rest}` ? TString : never;

export type StringReplaceHead<
  TString extends string,
  TNeedle extends string,
  TReplace extends string
> = TString extends `${TNeedle}${infer TRest}`
  ? `${TReplace}${TRest}`
  : TString;
