import { VersionExtractor } from './version-extractor'

export interface DateVersionExtractor extends VersionExtractor {
  parseDate: (version: string) => Date
}
