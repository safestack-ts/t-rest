import { describe, expectTypeOf, test } from 'vitest'
import { HTTPMethod } from './http-method.js'

type IsExact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false

describe('HTTPMethod', () => {
  test('is the union of the five supported verbs', () => {
    expectTypeOf<
      IsExact<HTTPMethod, 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>
    >().toEqualTypeOf<true>()
  })
})
