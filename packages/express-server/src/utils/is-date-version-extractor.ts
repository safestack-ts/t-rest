import { DateVersionExtractor } from '../types/date-version-extractor'
import { VersionExtractor } from '../types/version-extractor'

export const isDateVersionExtractor = (
  versionExtrator: VersionExtractor
): versionExtrator is DateVersionExtractor => {
  return 'parseDate' in versionExtrator
}
