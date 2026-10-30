import { expect, test } from 'vitest'
import {
  VersionInjector,
  SupertestVersionInjector,
} from './version-injector.js'
import { SupertestTargetError } from './supertest-target-error.js'

test('is recognized by its brand', () => {
  const error = new SupertestTargetError('message')

  expect(error).toBeInstanceOf(Error)
  expect(error).toBeInstanceOf(SupertestTargetError)
  expect(SupertestTargetError.isSupertestTargetError(error)).toBe(true)
  expect(SupertestTargetError.isSupertestTargetError(new Error())).toBe(false)
  expect(error.name).toBe('SupertestTargetError')
})

test('the deprecated VersionInjector is the SupertestVersionInjector', () => {
  expect(VersionInjector).toBe(SupertestVersionInjector)
})
