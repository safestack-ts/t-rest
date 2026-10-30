import { expect, test } from 'vitest'
import { readVersion, versionHeader, writeVersion } from './version-header.js'

const convention = versionHeader('X-Api-Version')

test('versionHeader declares a header convention', () => {
  expect(convention).toEqual({ kind: 'header', name: 'X-Api-Version' })
})

test('reads the version from lower-cased headers', () => {
  expect(readVersion(convention, { 'x-api-version': '2024-01-01' })).toBe(
    '2024-01-01'
  )
})

test('reads the version from headers with the declared casing', () => {
  expect(readVersion(convention, { 'X-Api-Version': '2' })).toBe('2')
})

test('reads the first value of array headers', () => {
  expect(readVersion(convention, { 'x-api-version': ['1', '2'] })).toBe('1')
})

test('reads the version through a getter', () => {
  expect(
    readVersion(convention, (name) =>
      name === 'X-Api-Version' ? '3' : undefined
    )
  ).toBe('3')
})

test('returns undefined without a version', () => {
  expect(readVersion(convention, {})).toBeUndefined()
  expect(readVersion(convention, { 'x-api-version': 1 })).toBeUndefined()
  expect(readVersion(convention, () => undefined)).toBeUndefined()
})

test('writes the version into a new headers object', () => {
  const headers = { accept: 'application/json' }

  expect(writeVersion(convention, headers, '2')).toEqual({
    accept: 'application/json',
    'X-Api-Version': '2',
  })
  expect(headers).toEqual({ accept: 'application/json' })
})

test('the written version wins over an existing header', () => {
  expect(
    writeVersion(convention, { 'x-api-version': '1', other: 'a' }, '2')
  ).toEqual({ other: 'a', 'X-Api-Version': '2' })
})
