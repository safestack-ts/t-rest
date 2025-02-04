export function findNearestLowerDate(sortedDates: Date[], needleDate: Date) {
  let lowerDate: Date | null = null
  let lowerDateIndex: number | null = null
  let left = 0
  let right = sortedDates.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (sortedDates[mid] < needleDate) {
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
