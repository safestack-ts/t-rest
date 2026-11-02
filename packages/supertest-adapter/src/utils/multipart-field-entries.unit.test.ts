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

  test('leaves out undefined and empty arrays and objects', () => {
    expect(
      multipartFieldEntries({ a: undefined, b: [], c: {}, d: [undefined] })
    ).toEqual([])
  })

  test('sends null as an empty string', () => {
    expect(multipartFieldEntries({ a: null, b: [null] })).toEqual([
      ['a', ''],
      ['b[0]', ''],
    ])
  })

  test('serializes values with toJSON through it', () => {
    class Money {
      constructor(private readonly cents: number) {}
      toJSON() {
        return { amount: this.cents / 100, currency: 'CHF' }
      }
    }

    expect(multipartFieldEntries({ price: new Money(150) })).toEqual([
      ['price[amount]', '1.5'],
      ['price[currency]', 'CHF'],
    ])
  })

  test('serializes other class instances by their own keys', () => {
    class Point {
      constructor(public x: number, public y: number) {}
    }

    expect(multipartFieldEntries({ point: new Point(1, 2) })).toEqual([
      ['point[x]', '1'],
      ['point[y]', '2'],
    ])
  })

  test('sends buffers as text fields', () => {
    expect(multipartFieldEntries({ a: Buffer.from('text') })).toEqual([
      ['a', 'text'],
    ])
  })

  test('rejects objects that multer would parse back as an array', () => {
    expect(() =>
      multipartFieldEntries({ byIndex: { '0': 'a', '1': 'b' } })
    ).toThrow(/"byIndex" only has numeric keys/)
    expect(multipartFieldEntries({ mixed: { '0': 'a', label: 'b' } })).toEqual([
      ['mixed[0]', 'a'],
      ['mixed[label]', 'b'],
    ])
  })
})
