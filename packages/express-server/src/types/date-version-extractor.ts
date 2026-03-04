import { VersionExtractor } from './version-extractor.js'

export interface DateVersionExtractor extends VersionExtractor {
  parseDate: (version: string) => Date
}
