export type StringReplaceHead<
  TString extends string,
  TNeedle extends string,
  TReplace extends string
> = TString extends `${TNeedle}${infer TRest}`
  ? `${TReplace}${TRest}`
  : TString;
