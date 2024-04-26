import { findNearestLowerDate } from './find-nearest-lower-date'

const dates = [
  new Date('2024-01-01'),
  new Date('2024-02-01'),
  new Date('2024-03-01'),
  new Date('2024-04-01'),
  new Date('2024-05-01'),
]

test('finds nearest lower date for needle somewhere in the middle', () => {
  const needle = new Date('2024-03-15')

  const nearestLowerDate = findNearestLowerDate(dates, needle)

  expect(nearestLowerDate).toEqual<typeof nearestLowerDate>({
    lowerDate: new Date('2024-03-01'),
    lowerDateIndex: 2,
  })
})

test('finds nearest lower date for needle after last element', () => {
  const needle = new Date('2024-10-15')

  const nearestLowerDate = findNearestLowerDate(dates, needle)

  expect(nearestLowerDate).toEqual<typeof nearestLowerDate>({
    lowerDate: new Date('2024-05-01'),
    lowerDateIndex: 4,
  })
})

test('return null if needle is before first available date', () => {
  const needle = new Date('2022-10-15')

  const nearestLowerDate = findNearestLowerDate(dates, needle)

  expect(nearestLowerDate).toBeNull()
})
