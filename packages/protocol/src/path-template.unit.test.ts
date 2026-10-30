import { expect, test } from 'vitest'
import {
  fillPathParams,
  joinPaths,
  pathParamNames,
  pathShape,
} from './path-template.js'

test('pathShape replaces path params with placeholder', () => {
  expect(pathShape('/users/:userId/tags/:tagId')).toBe('/users/%s/tags/%s')
})

test('pathShape replaces path params containing underscores', () => {
  expect(pathShape('/users/:user_id')).toBe('/users/%s')
  expect(pathShape('/users/:user_id')).toBe(pathShape('/users/:userId'))
})

test('pathShape keeps paths without params', () => {
  expect(pathShape('/users')).toBe('/users')
})

test('pathParamNames lists the param names in order', () => {
  expect(pathParamNames('/a/:x/b/:y_z')).toEqual(['x', 'y_z'])
  expect(pathParamNames('/a/b')).toEqual([])
})

test('fillPathParams fills and encodes params', () => {
  expect(fillPathParams('/a/:id/b/:name', { id: 1, name: 'a b/c' })).toBe(
    '/a/1/b/a%20b%2Fc'
  )
})

test('fillPathParams keeps unmatched placeholders', () => {
  expect(fillPathParams('/a/:id/:other', { id: 1 })).toBe('/a/1/:other')
  expect(fillPathParams('/a/:id')).toBe('/a/:id')
  expect(fillPathParams('/a/:id', null)).toBe('/a/:id')
})

test('fillPathParams matches placeholders by their whole name', () => {
  expect(fillPathParams('/a/:id/:idx', { id: 1 })).toBe('/a/1/:idx')
})

test('joinPaths joins prefix and path', () => {
  expect(joinPaths('/a', '/b')).toBe('/a/b')
  expect(joinPaths('a', 'b')).toBe('/a/b')
  expect(joinPaths('/a/', '/b/')).toBe('/a/b')
})

test('joinPaths joins root prefix with path', () => {
  expect(joinPaths('/', '/a')).toBe('/a')
  expect(joinPaths('', '/a')).toBe('/a')
  expect(joinPaths('/a', '/')).toBe('/a')
  expect(joinPaths('/a', '')).toBe('/a')
})

test('joinPaths keeps the root slash when joining root paths', () => {
  expect(joinPaths('/', '/')).toBe('/')
  expect(joinPaths('', '')).toBe('/')
  expect(joinPaths('', '/')).toBe('/')
  expect(joinPaths('/', '')).toBe('/')
})
