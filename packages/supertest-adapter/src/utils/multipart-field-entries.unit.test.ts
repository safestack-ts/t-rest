import { describe, expect, test } from 'vitest'
import { multipartFieldEntries } from './multipart-field-entries.js'

describe('multipartFieldEntries', () => {
  test('keeps strings as they are', () => {
    expect(multipartFieldEntries({ tags: '["a"]' })).toEqual([
      ['tags', '["a"]'],
    ])
  })

  test('indexes arrays and brackets object keys', () => {
    expect(
      multipartFieldEntries({ tags: ['a'], meta: { items: [{ id: 1 }] } })
    ).toEqual([
      ['tags[0]', 'a'],
      ['meta[items][0][id]', '1'],
    ])
  })

  test('stringifies scalars and dates', () => {
    const date = new Date('2024-01-01T00:00:00.000Z')

    expect(multipartFieldEntries({ count: 2, flag: false, date })).toEqual([
      ['count', '2'],
      ['flag', 'false'],
      ['date', '2024-01-01T00:00:00.000Z'],
    ])
  })

  test('leaves out undefined and null', () => {
    expect(
      multipartFieldEntries({ a: undefined, b: null, c: [undefined] })
    ).toEqual([])
  })
})
