import { expect, test } from 'vitest'
import { isFormDataLike } from './is-form-data-like.js'

test('recognizes the global FormData', () => {
  expect(isFormDataLike(new FormData())).toBe(true)
})

test('recognizes FormData implementations by their tag', () => {
  class ForeignFormData {
    append() {}
    get [Symbol.toStringTag]() {
      return 'FormData'
    }
  }
  class LegacyFormData {
    append() {}
    toString() {
      return '[object FormData]'
    }
  }

  expect(isFormDataLike(new ForeignFormData())).toBe(true)
  expect(isFormDataLike(new LegacyFormData())).toBe(true)
})

test('rejects json bodies', () => {
  expect(isFormDataLike({ append: 'x' })).toBe(false)
  expect(isFormDataLike({ name: 'a' })).toBe(false)
  expect(isFormDataLike(null)).toBe(false)
  expect(isFormDataLike('a')).toBe(false)
})
