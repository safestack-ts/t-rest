import { expect, test } from 'vitest'
import { joinPath } from './join-path.js'

test('joins prefix and path', () => {
  expect(joinPath('/a', '/b')).toBe('/a/b')
  expect(joinPath('a', 'b')).toBe('/a/b')
  expect(joinPath('/a/', '/b/')).toBe('/a/b')
})

test('joins root prefix with path', () => {
  expect(joinPath('/', '/a')).toBe('/a')
  expect(joinPath('', '/a')).toBe('/a')
  expect(joinPath('/a', '/')).toBe('/a')
  expect(joinPath('/a', '')).toBe('/a')
})

test('keeps the root slash when joining root paths', () => {
  expect(joinPath('/', '/')).toBe('/')
  expect(joinPath('', '')).toBe('/')
  expect(joinPath('', '/')).toBe('/')
  expect(joinPath('/', '')).toBe('/')
})
