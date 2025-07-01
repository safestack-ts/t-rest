import { buildUrl } from './build-url'

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
      tags: ['tag1', 'tag2'],
      nestedFilter: {
        nested: {
          key: 'value',
        },
      },
    },
  }

  expect(buildUrl(url, request)).toBe(
    '/account/123/persons/1337?filter=%7B%22key%22%3A%22value%22%7D&tags=%5B%22tag1%22%2C%22tag2%22%5D&nestedFilter=%7B%22nested%22%3A%7B%22key%22%3A%22value%22%7D%7D'
  )
  expect(decodeURIComponent(buildUrl(url, request))).toBe(
    '/account/123/persons/1337?filter={"key":"value"}&tags=["tag1","tag2"]&nestedFilter={"nested":{"key":"value"}}'
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
