import { normalizePathPattern } from './normalize-path-pattern.js'

test('replaces path params with placeholder', () => {
  expect(normalizePathPattern('/users/:userId/tags/:tagId')).toBe(
    '/users/%s/tags/%s'
  )
})

test('replaces path params containing underscores', () => {
  expect(normalizePathPattern('/users/:user_id')).toBe('/users/%s')
  expect(normalizePathPattern('/users/:user_id')).toBe(
    normalizePathPattern('/users/:userId')
  )
})
