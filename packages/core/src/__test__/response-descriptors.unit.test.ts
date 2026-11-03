import { expect, test } from 'vitest'
import { z } from 'zod'
import { Route } from '../classes/core/route.js'
import { emptyValidation } from '../utils/empty-validation.js'
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

test('descriptors without options carry no documentation keys', () => {
  expect(json()).toStrictEqual({
    kind: 'json',
    contentType: 'application/json',
    '~body': null,
  })
  expect(text()).toStrictEqual({
    kind: 'text',
    contentType: 'text/plain',
    '~body': null,
  })
  expect(binary('application/pdf')).toStrictEqual({
    kind: 'binary',
    contentType: 'application/pdf',
    '~body': null,
  })
  expect(empty()).toStrictEqual({
    kind: 'empty',
    contentType: undefined,
    '~body': null,
  })
})

test('json(schema, options) carries the schema and its documentation', () => {
  const Person = z.object({ id: z.string() })
  const headers = z.object({ etag: z.string() })
  const examples = { ada: { value: { id: 'ada' } } }

  expect(json(Person)).toStrictEqual({
    kind: 'json',
    contentType: 'application/json',
    '~body': null,
    schema: Person,
  })
  expect(
    json(Person, { description: 'The person', headers, examples, id: 'Person' })
  ).toStrictEqual({
    kind: 'json',
    contentType: 'application/json',
    '~body': null,
    schema: Person,
    description: 'The person',
    headers,
    examples,
    id: 'Person',
  })
})

test('json<T>(options) documents a response without a schema', () => {
  expect(json<{ id: string }>({ description: 'The person' })).toStrictEqual({
    kind: 'json',
    contentType: 'application/json',
    '~body': null,
    description: 'The person',
  })
})

test('text, binary and empty descriptors carry their documentation', () => {
  const headers = z.object({ 'content-disposition': z.string() })

  expect(
    text('text/csv', {
      description: 'The report',
      examples: { header: { value: 'id' } },
    })
  ).toMatchObject({
    contentType: 'text/csv',
    description: 'The report',
    examples: { header: { value: 'id' } },
  })
  expect(text(undefined, { description: 'Plain' })).toMatchObject({
    contentType: 'text/plain',
    description: 'Plain',
  })
  expect(
    binary('application/pdf', { description: 'The invoice', headers })
  ).toMatchObject({ description: 'The invoice', headers })
  expect(empty({ description: 'Deleted', id: 'Deleted' })).toMatchObject({
    kind: 'empty',
    description: 'Deleted',
    id: 'Deleted',
  })
})

test('emptyValidation describes an object without properties as JSON Schema', () => {
  const { jsonSchema, vendor } = emptyValidation['~standard']

  expect(vendor).toBe('t-rest')
  expect(jsonSchema.input({ target: 'draft-2020-12' })).toEqual({
    type: 'object',
  })
  expect(jsonSchema.output({ target: 'openapi-3.0' })).toEqual({
    type: 'object',
  })
})
