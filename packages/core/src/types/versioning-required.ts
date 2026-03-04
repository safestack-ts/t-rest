import { Versioning } from '../enums/versioning.js'

export type VersioningRequired = Exclude<Versioning, Versioning.NO_VERSIONING>
