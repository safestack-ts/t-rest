import { RemoveReadonlyDeep } from '../types/remove-readonly.js'

export const VersionHistory = <TVersions extends readonly string[]>(
  versions: TVersions
) => versions as RemoveReadonlyDeep<TVersions>
