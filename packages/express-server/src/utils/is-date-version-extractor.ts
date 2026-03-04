import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { VersionExtractor } from '../types/version-extractor.js'

export const isDateVersionExtractor = (
  versionExtrator: VersionExtractor
): versionExtrator is DateVersionExtractor => {
  return 'parseDate' in versionExtrator
}
