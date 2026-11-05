import { buildOpenAPI } from '@t-rest/open-api-generator'
import { describe, expect, test } from 'vitest'
import { bag as routesBag } from './documenting-routes/default-responses.js'
import { build as operationIds } from './documenting-routes/operation-id.js'
import { build as routeMeta } from './documenting-routes/route-meta.js'
import { build as migrated } from './migration/after-generator.js'
import { materialized, referenced } from './naming-components/aliases.js'
import { build as split } from './naming-components/direction-split.js'
import { build as modelsCheck } from './naming-components/models-check.js'
import { build as pages } from './naming-components/name-anonymous.js'
import { build as filtered } from './readme/filter.js'
import { build as versioned } from './readme/versions.js'
import { build as security } from './security/config.js'
import { build as fromHeaders } from './security/from-headers.js'
import { build as trusted } from './validator-support/custom-vendor.js'

type Build = ReturnType<typeof buildOpenAPI>

const documentOf = (build: Build, index = 0) =>
  build.specs[index].document as any
const schemas = (build: Build) => documentOf(build).components.schemas
const codes = (build: Build) => build.diagnostics.map(({ code }) => code)
const operations = (build: Build) =>
  Object.values(documentOf(build).paths).flatMap((item: any) =>
    Object.values(item)
  ) as any[]
const responseSchema = (build: Build, path: string, method = 'get') =>
  documentOf(build).paths[path][method].responses['200'].content[
    'application/json'
  ].schema

describe('naming components', () => {
  test('an alias refers to its target by default', () => {
    expect(codes(referenced)).toEqual([])
    expect(schemas(referenced).Admin_Order).toEqual({
      $ref: '#/components/schemas/Shop_Order',
    })
    expect(Object.keys(schemas(referenced))).toContain('Shop_Order')
  })

  test('a materialized alias is a shallow copy', () => {
    expect(Object.keys(schemas(materialized))).toEqual([
      'Admin_Customer',
      'Admin_Order',
      'Shop_Customer',
    ])
    expect(schemas(materialized).Admin_Order.properties.customer).toEqual({
      $ref: '#/components/schemas/Shop_Customer',
    })
  })

  test('nameAnonymous names the page objects per route', () => {
    expect(codes(pages)).toEqual([])
    expect(responseSchema(pages, '/orders')).toEqual({
      $ref: '#/components/schemas/Shop_OrderPage',
    })
    expect(responseSchema(pages, '/customers')).toEqual({
      $ref: '#/components/schemas/Shop_CustomerPage',
    })
  })

  test('a default splits the schema and every schema above it', () => {
    expect(Object.keys(schemas(split))).toEqual([
      'Profile',
      'ProfileWrite',
      'Settings',
      'SettingsWrite',
    ])
    expect(codes(split)).toEqual([
      'naming/direction-split',
      'naming/direction-split',
    ])
  })

  test('naming.models reports the derived schema without id', () => {
    expect(
      modelsCheck.diagnostics.map(({ code, data }) => [code, data])
    ).toEqual([['naming/model-without-id', { key: 'CustomerWithNotes' }]])
  })
})

describe('documenting routes', () => {
  const build = buildOpenAPI({
    bag: routesBag,
    info: { title: 'Shop' },
    specs: [{ target: '3.1', output: 'shop.yaml' }],
  })

  test('every operation refers to the shared error responses', () => {
    expect(codes(build)).toEqual([])
    for (const operation of operations(build)) {
      expect(operation.responses['400']).toEqual({
        $ref: '#/components/responses/BadRequest',
      })
      expect(operation.responses['500']).toEqual({
        $ref: '#/components/responses/InternalError',
      })
    }
  })

  test('operationId comes from meta, the hook, or the path', () => {
    expect(operations(operationIds).map((op) => op.operationId)).toEqual([
      'listOrders',
      'getOrdersByOrderId',
      'ordersCancel',
    ])
  })

  test('custom meta filters the spec and x- keys become extensions', () => {
    const [operation] = operations(routeMeta)

    expect(Object.keys(documentOf(routeMeta).paths)).toEqual(['/orders'])
    expect(operation['x-rate-limit']).toBe(100)
    expect(operation).not.toHaveProperty('audience')
    expect(routeMeta.specs[0].model.operations[0].extensions).toEqual({
      audience: 'public',
      'x-rate-limit': 100,
    })
  })
})

describe('security', () => {
  test('each operation carries its own requirements', () => {
    const paths = documentOf(security).paths

    expect(paths['/health'].get).not.toHaveProperty('security')
    expect(paths['/orders'].get.security).toEqual([{ bearer: [] }])
    expect(paths['/orders/{orderId}'].get.security).toEqual([
      { bearer: [] },
      { apiKey: [] },
    ])
    expect(paths['/products'].get.security).toEqual([{ bearer: [] }, {}])
    expect(documentOf(security)).not.toHaveProperty('security')
  })

  test('securityFromHeaders turns the header into the scheme', () => {
    const paths = documentOf(fromHeaders).paths

    expect(paths['/orders'].get.security).toEqual([{ bearer: [] }])
    expect(paths['/products'].get.security).toEqual([{ bearer: [] }, {}])
    expect(paths['/orders'].get).not.toHaveProperty('parameters')
  })
})

describe('the README', () => {
  test('the public spec keeps only public routes', () => {
    expect(Object.keys(documentOf(filtered, 1).paths)).toEqual(['/products'])
  })

  test('versions all writes one spec per version, version the newest', () => {
    expect(versioned.specs.map(({ output }) => output)).toEqual([
      'openapi/2024-01-01.json',
      'openapi/2025-01-01.json',
      'openapi/latest.yaml',
    ])
    expect(documentOf(versioned, 2).info.version).toBe('2025-01-01')
  })
})

describe('validator support and migration', () => {
  test('a trusted vendor names its definitions', () => {
    expect(responseSchema(trusted, '/origin')).toEqual({
      $ref: '#/components/schemas/Geo_Point',
    })
  })

  test('a re-exported model keeps the id of its definition', () => {
    expect(codes(migrated)).toEqual([])
    expect(responseSchema(migrated, '/me/address')).toEqual({
      $ref: '#/components/schemas/V2024_01_01_Shared_Address',
    })
  })
})
