import { readVersion, type VersionConvention } from '@t-rest/protocol'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'
import { VersionExtractor } from '../types/version-extractor.js'

// reads the version from the request the way the client writes it. Passing
// `parseDate` returns a DateVersionExtractor, which resolves versions by date.
export function versionExtractorFrom(
  convention: VersionConvention,
  options?: { parseDate?: undefined }
): VersionExtractor
export function versionExtractorFrom(
  convention: VersionConvention,
  options: { parseDate: (version: string) => Date }
): DateVersionExtractor
export function versionExtractorFrom(
  convention: VersionConvention,
  options?: { parseDate?: (version: string) => Date }
): VersionExtractor | DateVersionExtractor {
  const extractVersion = (request: ExpressRequest) =>
    readVersion(convention, request.headers)

  return options?.parseDate
    ? { extractVersion, parseDate: options.parseDate }
    : { extractVersion }
}
