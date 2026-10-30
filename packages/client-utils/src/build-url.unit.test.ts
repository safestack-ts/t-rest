import { expect, test } from 'vitest'
import { buildUrl } from './build-url.js'

test('delegates to the protocol url builder', () => {
  expect(
    buildUrl('/account/:accountId', {
      params: { accountId: '123' },
      query: { search: 'test' },
    })
  ).toBe('/account/123?search=test')
})
