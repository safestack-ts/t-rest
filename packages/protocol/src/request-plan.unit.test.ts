import { expect, test } from 'vitest'
import { planRequest } from './request-plan.js'

test('builds the url from params and query', () => {
  expect(
    planRequest('GET', '/users/:id', { params: { id: 1 }, query: { a: 'b' } })
      .url
  ).toBe('/users/1?a=b')
})

test('keeps the path without input', () => {
  expect(planRequest('GET', '/users/:id').url).toBe('/users/:id')
})

test('GET and DELETE do not send a body', () => {
  expect(planRequest('GET', '/a', { body: { x: 1 } }).body).toEqual({
    send: false,
  })
  expect(planRequest('DELETE', '/a', { body: { x: 1 } }).body).toEqual({
    send: false,
  })
})

test('POST, PUT and PATCH send the body', () => {
  for (const method of ['POST', 'PUT', 'PATCH'] as const) {
    expect(planRequest(method, '/a', { body: { x: 1 } }).body).toEqual({
      send: true,
      value: { x: 1 },
    })
  }
})

test('sends an undefined body without input', () => {
  expect(planRequest('POST', '/a').body).toEqual({
    send: true,
    value: undefined,
  })
})
