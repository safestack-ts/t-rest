import { VersionExtractor } from '../types/version-extractor'

export class NoVersionExtractor implements VersionExtractor {
  extractVersion() {
    return ''
  }
}
