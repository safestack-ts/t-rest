import { expect, test } from 'vitest'
import { buildUrl } from './build-url.js'

const url = '/account/:accountId/persons/:personId'

test('params are filled', () => {
  const request = {
    params: {
      accountId: '123',
      personId: 1337,
    },
  }

  expect(buildUrl(url, request)).toBe('/account/123/persons/1337')
})

test('query with primitive data types is appended', () => {
  const request = {
    params: {
      accountId: '123',
      personId: 1337,
    },
    query: {
      search: 'test',
      page: 1,
      offset: 42,
      populated: true,
    },
  }

  expect(buildUrl(url, request)).toBe(
    '/account/123/persons/1337?search=test&page=1&offset=42&populated=true'
  )
})

test('query with object is appended correctly formatted', () => {
  const request = {
    params: {
      accountId: '123',
      personId: 1337,
    },
    query: {
      filter: {
        key: 'value',
      },
      nestedFilter: {
        nested: {
          key: 'value',
        },
      },
    },
  }

  expect(buildUrl(url, request)).toBe(
    '/account/123/persons/1337?filter=%7B%22key%22%3A%22value%22%7D&nestedFilter=%7B%22nested%22%3A%7B%22key%22%3A%22value%22%7D%7D'
  )
  expect(decodeURIComponent(buildUrl(url, request))).toBe(
    '/account/123/persons/1337?filter={"key":"value"}&nestedFilter={"nested":{"key":"value"}}'
  )
})

test('query with undefined values are omitted from url', () => {
  const request = {
    params: {
      accountId: '123',
      personId: 1337,
    },
    query: {
      search: 'test',
      page: 1,
      category: undefined,
      populated: true,
      filter: undefined,
      offset: 42,
    },
  }

  expect(buildUrl(url, request)).toBe(
    '/account/123/persons/1337?search=test&page=1&populated=true&offset=42'
  )
})

test('params sharing a name prefix are replaced by whole segment', () => {
  expect(buildUrl('/orgs/:idx/users/:id', { params: { id: 1, idx: 2 } })).toBe(
    '/orgs/2/users/1'
  )
})

test('every occurrence of a param is replaced', () => {
  expect(buildUrl('/a/:id/b/:id', { params: { id: 7 } })).toBe('/a/7/b/7')
})

test('placeholders without a matching param are left untouched', () => {
  expect(buildUrl('/a/:id/b/:other', { params: { id: 7 } })).toBe(
    '/a/7/b/:other'
  )
})

test('params are url-encoded', () => {
  expect(buildUrl('/files/:name', { params: { name: 'a/b?c=1#x' } })).toBe(
    '/files/a%2Fb%3Fc%3D1%23x'
  )
})

test('query with null values are omitted from url', () => {
  expect(
    buildUrl('/items', { query: { search: 'test', n: null, page: 1 } })
  ).toBe('/items?search=test&page=1')
})

test('query arrays are serialized as json', () => {
  expect(
    decodeURIComponent(
      buildUrl('/items', {
        query: { tags: ['a', 'b c'], ids: [1, 2], empty: [], page: 1 },
      })
    )
  ).toBe('/items?tags=["a","b+c"]&ids=[1,2]&empty=[]&page=1')
})

test('query arrays round trip through URLSearchParams as json', () => {
  const query = { ids: [1, 2], tags: ['a&b', 'c=d'], nested: [[1], { a: 1 }] }
  const searchParams = new URL(
    buildUrl('/items', { query }),
    'http://localhost'
  ).searchParams

  expect(JSON.parse(searchParams.get('ids')!)).toEqual(query.ids)
  expect(JSON.parse(searchParams.get('tags')!)).toEqual(query.tags)
  expect(JSON.parse(searchParams.get('nested')!)).toEqual(query.nested)
})

test('null and undefined array items are serialized as json null', () => {
  expect(
    decodeURIComponent(
      buildUrl('/items', { query: { tags: ['a', null, undefined, 'b'] } })
    )
  ).toBe('/items?tags=["a",null,null,"b"]')
})

test('object and date array items are serialized as json', () => {
  const date = new Date('2024-01-02T03:04:05.000Z')

  expect(
    decodeURIComponent(
      buildUrl('/items', { query: { items: [{ key: 'value' }, date] } })
    )
  ).toBe('/items?items=[{"key":"value"},"2024-01-02T03:04:05.000Z"]')
})
