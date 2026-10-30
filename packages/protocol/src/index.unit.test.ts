import { expect, test } from 'vitest'

test('runtime exports are plain functions and data only', async () => {
  const exports = Object.values(await import('./index.js'))

  expect(exports.length).toBeGreaterThan(0)

  for (const value of exports) {
    if (typeof value === 'function') {
      // arrow functions have no prototype, classes and `function` declarations do
      expect(value.prototype).toBeUndefined()
    } else {
      expect(['object', 'string', 'number', 'boolean']).toContain(typeof value)
    }
  }
})

test('exports no symbols', async () => {
  for (const value of Object.values(await import('./index.js'))) {
    expect(typeof value).not.toBe('symbol')
  }
})
