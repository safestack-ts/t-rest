import { expect, test } from 'vitest'
import { findNearestLowerDate } from './find-nearest-lower-date.js'

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

test('finds date equal to needle', () => {
  const needle = new Date('2024-03-01T00:00:00.000Z')

  const nearestLowerDate = findNearestLowerDate(dates, needle)

  expect(nearestLowerDate).toEqual<typeof nearestLowerDate>({
    lowerDate: new Date('2024-03-01'),
    lowerDateIndex: 2,
  })
})

test('return null if needle is an invalid date', () => {
  const nearestLowerDate = findNearestLowerDate(dates, new Date('invalid'))

  expect(nearestLowerDate).toBeNull()
})
