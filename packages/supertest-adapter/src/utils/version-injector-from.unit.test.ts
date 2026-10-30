import { expect, test } from 'vitest'
import { versionHeader } from '@t-rest/protocol'
import { SupertestVersionInjector } from '../classes/version-injector.js'
import { versionInjectorFrom } from './version-injector-from.js'

test('writes the version of the call into the header of the convention', () => {
  const injector = versionInjectorFrom(versionHeader('X-Api-Version'))

  expect(injector).toBeInstanceOf(SupertestVersionInjector)
  expect(
    injector.modifyHeaders(
      { 'x-api-version': '2000-01-01', accept: 'text/plain' },
      '2024-01-01'
    )
  ).toEqual({ accept: 'text/plain', 'X-Api-Version': '2024-01-01' })
})

test('leaves the url as it is', () => {
  const injector = versionInjectorFrom(versionHeader('x-api-version'))

  expect(injector.modifyUrl('/items/:itemId', '2024-01-01')).toBe(
    '/items/:itemId'
  )
})
