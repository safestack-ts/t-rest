import { binary, empty, json, text } from '@t-rest/core'
import { expect, test } from 'vitest'
import { decodeBody, isDeclaredStatus } from './response-decoding.js'

const encode = (value: string) => new TextEncoder().encode(value)

test('isDeclaredStatus() checks the statuses of the responses', () => {
  const responses = { 200: json(), 404: json() }

  expect(isDeclaredStatus(responses, 200)).toBe(true)
  expect(isDeclaredStatus(responses, 404)).toBe(true)
  expect(isDeclaredStatus(responses, 500)).toBe(false)
  expect(isDeclaredStatus(responses, 201)).toBe(false)
})

test('decodeBody() parses json from text and bytes', () => {
  expect(decodeBody('{"id":1}', json())).toEqual({ id: 1 })
  expect(decodeBody(encode('{"id":1}'), json())).toEqual({ id: 1 })
  expect(decodeBody(encode('{"id":1}').buffer, json())).toEqual({ id: 1 })
})

test('decodeBody() decodes an empty json body as undefined', () => {
  expect(decodeBody('', json())).toBeUndefined()
  expect(decodeBody(new ArrayBuffer(0), json())).toBeUndefined()
})

test('decodeBody() throws for invalid json', () => {
  expect(() => decodeBody('<html>', json())).toThrow(SyntaxError)
})

test('decodeBody() keeps text as string, even when it looks like json', () => {
  expect(decodeBody(encode('123'), text('text/csv'))).toBe('123')
  expect(decodeBody('123', text())).toBe('123')
})

test('decodeBody() returns binary bodies as exact array buffer', () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4])
  // a view on a part of a larger buffer, like node's pooled buffers
  const view = bytes.subarray(1, 4)
  const decoded = decodeBody(view, binary('application/pdf'))

  expect(decoded).toBeInstanceOf(ArrayBuffer)
  expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(
    new Uint8Array([1, 2, 3])
  )
})

test('decodeBody() decodes empty bodies as undefined', () => {
  expect(decodeBody('ignored', empty())).toBeUndefined()
})

test('decodeBody() returns the body as is without a descriptor', () => {
  expect(decodeBody('raw', undefined)).toBe('raw')
})
