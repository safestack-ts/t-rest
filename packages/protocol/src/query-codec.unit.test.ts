import { expect, test } from 'vitest'
import { decodeStructuredQueryValue, encodeQuery } from './query-codec.js'

test('encodes primitive values', () => {
  expect(encodeQuery({ search: 'a b', page: 1, on: true })).toBe(
    'search=a+b&page=1&on=true'
  )
})

test('omits undefined and null values', () => {
  expect(encodeQuery({ a: undefined, b: null, c: 0 })).toBe('c=0')
})

test('encodes objects and arrays as JSON', () => {
  expect(decodeURIComponent(encodeQuery({ filter: { key: 'value' } }))).toBe(
    'filter={"key":"value"}'
  )
  expect(decodeURIComponent(encodeQuery({ ids: [1, 2], none: [] }))).toBe(
    'ids=[1,2]&none=[]'
  )
})

test('encodes values with toJSON via toJSON', () => {
  const date = new Date('2024-01-02T03:04:05.000Z')

  expect(decodeURIComponent(encodeQuery({ date }))).toBe(
    'date=2024-01-02T03:04:05.000Z'
  )
})

test('returns an empty string without query', () => {
  expect(encodeQuery(undefined)).toBe('')
  expect(encodeQuery({})).toBe('')
})

test('decodes structured values', () => {
  expect(decodeStructuredQueryValue('{"a":[1,2]}')).toEqual({ a: [1, 2] })
  expect(decodeStructuredQueryValue('[]')).toEqual([])
  expect(decodeStructuredQueryValue('"text"')).toBe('text')
})

test('returns values that are not parseable JSON unchanged', () => {
  expect(decodeStructuredQueryValue('{nope')).toBe('{nope')
  expect(decodeStructuredQueryValue(42)).toBe(42)
  const object = { a: 1 }
  expect(decodeStructuredQueryValue(object)).toBe(object)
})

test('roundtrips encoded structured values', () => {
  const value = { nested: { ids: [1, 2] } }
  const encoded = new URLSearchParams(encodeQuery({ value })).get('value')

  expect(decodeStructuredQueryValue(encoded)).toEqual(value)
})
