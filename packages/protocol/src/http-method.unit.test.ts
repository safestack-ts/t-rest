import { expect, test } from 'vitest'
import { HTTP_METHODS, methodSendsBody } from './http-method.js'

test('lists the supported methods', () => {
  expect(HTTP_METHODS).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
})

test('GET and DELETE do not send a body', () => {
  expect(methodSendsBody('GET')).toBe(false)
  expect(methodSendsBody('DELETE')).toBe(false)
})

test('POST, PUT and PATCH send a body', () => {
  expect(methodSendsBody('POST')).toBe(true)
  expect(methodSendsBody('PUT')).toBe(true)
  expect(methodSendsBody('PATCH')).toBe(true)
})
