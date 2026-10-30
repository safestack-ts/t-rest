// finds the nearest date in sortedDates which is lower than or equal to needleDate
/** @deprecated Internal helper, will be removed from the public API in a future major. */
export function findNearestLowerDate(sortedDates: Date[], needleDate: Date) {
  let lowerDate: Date | null = null
  let lowerDateIndex: number | null = null
  let left = 0
  let right = sortedDates.length - 1
  const needleTime = needleDate.getTime()

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (sortedDates[mid].getTime() <= needleTime) {
      lowerDate = sortedDates[mid]
      lowerDateIndex = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return lowerDate !== null && lowerDateIndex !== null
    ? { lowerDate, lowerDateIndex }
    : null
}
