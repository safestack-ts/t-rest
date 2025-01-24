export type OlderVersions<
  TVersionHistory extends string[],
  TVersion extends TVersionHistory[number]
> = TVersionHistory extends [...infer TOlderVersions, infer TCurrentVersion]
  ? TCurrentVersion extends TVersion
    ? TOlderVersions extends string[]
      ? TOlderVersions[number]
      : never
    : TOlderVersions extends string[]
    ? OlderVersions<TOlderVersions, TVersion>
    : never
  : never
