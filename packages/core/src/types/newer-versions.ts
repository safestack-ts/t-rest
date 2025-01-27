export type NewerVersions<
  TVersionHistory extends string[],
  TVersion extends TVersionHistory[number]
> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion]
  ? TCurrentVersion extends TVersion
    ? never
    : TOlderVersions extends string[]
    ? TCurrentVersion | NewerVersions<TOlderVersions, TVersion>
    : never
  : never
