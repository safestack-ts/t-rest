import { findNearestLowerDate } from './find-nearest-lower-date'

export const resolveVersion = (
  versionHistory: string[],
  availableVersions: string[],
  requestedVersion: string
) => {
  if (availableVersions.includes(requestedVersion)) {
    return requestedVersion
  }

  const requestedVersionIndex = versionHistory.indexOf(requestedVersion)

  for (let i = requestedVersionIndex - 1; i >= 0; i--) {
    const version = versionHistory[i]

    if (availableVersions.includes(version)) {
      return versionHistory[i]
    }
  }

  return null
}

export const resolveDateVersion = (
  versionHistory: string[],
  availableVersions: string[],
  requestedVersion: string,
  parseDate: (version: string) => Date
) => {
  const simpleResolvedVersion = resolveVersion(
    versionHistory,
    availableVersions,
    requestedVersion
  )

  if (simpleResolvedVersion) {
    return simpleResolvedVersion
  } else {
    // need to parse versions and find matching date version
    const versionHistoryDates = versionHistory.map(parseDate)
    const requestedDateVersion = parseDate(requestedVersion)

    const nearestLowerDateResult = findNearestLowerDate(
      versionHistoryDates,
      requestedDateVersion
    )

    if (!nearestLowerDateResult) {
      return null
    }

    const { lowerDateIndex } = nearestLowerDateResult

    for (let i = lowerDateIndex; i >= 0; i--) {
      const version = versionHistory[i]
      if (availableVersions.includes(version)) {
        return version
      }
    }
  }
}
