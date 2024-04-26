export type StringStartsWith<
  TString extends string,
  TStart extends string
> = TString extends `${TStart}${infer _Rest}` ? TString : never;
