import { expect, test } from 'vitest'
import { versionHeader } from '@t-rest/protocol'
import { versionInjectorFrom } from './version-injector-from.js'

test('writes the version of the injector into the header of the convention', () => {
  const Injector = versionInjectorFrom(versionHeader('X-Api-Version'))

  expect(
    new Injector('2024-01-01').modifyHeaders({
      'x-api-version': '2000-01-01',
      accept: 'text/plain',
    })
  ).toEqual({ accept: 'text/plain', 'X-Api-Version': '2024-01-01' })
})

test('leaves the url as it is', () => {
  const Injector = versionInjectorFrom(versionHeader('x-api-version'))

  expect(new Injector('2024-01-01').modifyUrl('/items?page=1')).toBe(
    '/items?page=1'
  )
})
