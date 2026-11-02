import { expect, test } from 'vitest'
import { Route } from '../classes/core/route.js'
import { binary, empty, json, text } from '../utils/response-descriptors.js'

test('descriptors carry their kind and content type at runtime', () => {
  expect(json<{ id: number }>()).toMatchObject({
    kind: 'json',
    contentType: 'application/json',
  })
  expect(text()).toMatchObject({ kind: 'text', contentType: 'text/plain' })
  expect(text('text/csv')).toMatchObject({
    kind: 'text',
    contentType: 'text/csv',
  })
  expect(binary('application/pdf')).toMatchObject({
    kind: 'binary',
    contentType: 'application/pdf',
  })
  expect(empty()).toMatchObject({ kind: 'empty', contentType: undefined })
})

test('routes expose their responses at runtime', () => {
  const route = Route.get('/invoices/:id/pdf').responses({
    200: binary('application/pdf'),
    404: json<{ error: string }>(),
  })

  expect(Object.keys(route.responses)).toEqual(['200', '404'])
  expect(route.responses[200].contentType).toBe('application/pdf')
})

test('response<T>() is a shorthand for a json 200 response', () => {
  expect(Route.get('/').response<string>().responses).toEqual({ 200: json() })
  expect(
    Route.get('/').metaData({ a: 1 }).response<string>().responses
  ).toEqual({ 200: json() })
})

test('response<T>(status) declares a json body for the status', () => {
  expect(Route.post('/').response<string>(201).responses).toEqual({
    201: json(),
  })
  expect(
    Route.post('/').validate(null).response<string>(202).responses
  ).toEqual({ 202: json() })
  expect(Route.delete('/').response(204).responses).toEqual({ 204: empty() })
})
