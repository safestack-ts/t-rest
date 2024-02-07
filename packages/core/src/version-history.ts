import { RemoveReadonlyDeep } from "./remove-readonly";

export const VersionHistory = <TVersions extends readonly string[]>(
  versions: TVersions
) => versions as RemoveReadonlyDeep<TVersions>;
