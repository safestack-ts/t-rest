import { ExpressRequest } from './express-type-shortcuts.js'

export interface VersionExtractor {
  extractVersion: (request: ExpressRequest) => string | undefined | null
}
