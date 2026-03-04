import { VersionExtractor } from '../types/version-extractor.js'

export class NoVersionExtractor implements VersionExtractor {
  extractVersion() {
    return ''
  }
}
