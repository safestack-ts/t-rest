import { Versioning } from '../enums/versioning'

export type VersioningRequired = Exclude<Versioning, Versioning.NO_VERSIONING>
