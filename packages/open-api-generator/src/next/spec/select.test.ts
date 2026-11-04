import {
  BagOfRoutes,
  json,
  Route,
  securityScheme,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { codes, golden } from '../route/golden.js'
import { pipeline, typeNames } from './testing.js'

const ref = (target: string) => ({ kind: 'ref', target })
const itemsOf = (operation: { responses: Record<string, unknown> }) =>
  (operation.responses['200'] as any).response.content['application/json'].shape
    .items

describe('versions', () => {
  const ProductV1 = z
    .object({ id: z.number(), name: z.string() })
    .meta({ id: 'ProductV1' })
  const ProductV2 = z
    .object({ id: z.number(), title: z.string(), tags: z.array(z.string()) })
    .meta({ id: 'ProductV2' })
  const Order = z
    .object({ id: z.number(), productIds: z.array(z.number()) })
    .meta({ id: 'Order' })
  const history = VersionHistory([
    '2024-01-01',
    '2025-01-01',
    '2026-01-01',
  ] as const)
  const bag = BagOfRoutes.withVersioning(Versioning.DATE, history)
    .addRoute(
      Route.version('2024-01-01')
        .get('/products')
        .responses({ 200: json(z.array(ProductV1)) })
    )
    .addRoute(
      Route.version('2026-01-01')
        .get('/products')
        .responses({ 200: json(z.array(ProductV2)) })
    )
    .addRoute(
      Route.version('2025-01-01')
        .get('/orders')
        .responses({ 200: json(z.array(Order)) })
    )
    .build()
  const { spec } = pipeline(bag)

  test('only contains routes introduced up to the requested version', () => {
    const selected = spec({ version: '2024-01-01' })

    expect(selected.model.operations.map(({ key }) => key)).toEqual([
      'GET /products @2024-01-01',
    ])
    expect(itemsOf(selected.operation('GET /products @2024-01-01'))).toEqual(
      ref('ProductV1')
    )
    expect(typeNames(selected.model)).toEqual(['ProductV1'])
  })

  test('resolves the newest revision not newer than the requested version', () => {
    const selected = spec({ version: '2025-01-01' })

    expect(selected.model.operations.map(({ key }) => key)).toEqual([
      'GET /orders @2025-01-01',
      'GET /products @2024-01-01',
    ])
    expect(typeNames(selected.model).sort()).toEqual(['Order', 'ProductV1'])
  })

  test('uses the latest revision for the latest version', () => {
    const selected = spec({ version: '2026-01-01' })

    expect(itemsOf(selected.operation('GET /products @2026-01-01'))).toEqual(
      ref('ProductV2')
    )
    expect(typeNames(selected.model).sort()).toEqual(['Order', 'ProductV2'])
  })

  test('resolves a date outside the history to the version before it', () => {
    expect(
      spec({ version: '2025-06-30' }).model.operations.map(({ key }) => key)
    ).toEqual(['GET /orders @2025-01-01', 'GET /products @2024-01-01'])
    expect(spec({ version: '2023-01-01' }).model.operations).toEqual([])
  })

  test('selects the newest version without one', () => {
    expect(spec().model.operations.map(({ key }) => key)).toEqual([
      'GET /orders @2025-01-01',
      'GET /products @2026-01-01',
    ])
  })
})

describe('semantic versions', () => {
  const UserV1 = z
    .object({ id: z.number(), name: z.string() })
    .meta({ id: 'UserV1' })
  const UserV2 = z
    .object({ id: z.number(), firstName: z.string(), lastName: z.string() })
    .meta({ id: 'UserV2' })
  const history = VersionHistory(['1.0.0', '1.1.0', '2.0.0'] as const)
  const bag = BagOfRoutes.withVersioning(Versioning.SEMVER, history)
    .addRoute(
      Route.version('1.0.0')
        .get('/users')
        .responses({ 200: json(z.array(UserV1)) })
    )
    .addRoute(
      Route.version('2.0.0')
        .get('/users')
        .responses({ 200: json(z.array(UserV2)) })
    )
    .addRoute(
      Route.version('1.1.0')
        .get('/users/:userId')
        // @ts-expect-error invalid meta data the generator reports at runtime
        .metaData({ tags: 'users' })
        .responses({ 200: json(UserV1) })
    )
    .build()
  const built = pipeline(bag)

  test('resolves the newest revision not newer than the requested version', () => {
    const initial = built.spec({ version: '1.0.0' })
    expect(initial.model.operations.map(({ path }) => path)).toEqual(['/users'])
    expect(typeNames(initial.model)).toEqual(['UserV1'])

    const minor = built.spec({ version: '1.1.0' })
    expect(minor.model.operations.map(({ path }) => path)).toEqual([
      '/users',
      '/users/:userId',
    ])
    expect(typeNames(minor.model)).toEqual(['UserV1'])

    const major = built.spec({ version: '2.0.0' })
    expect(itemsOf(major.operation('GET /users @2.0.0'))).toEqual(ref('UserV2'))
  })

  test('reports routes with invalid meta data and omits the value', () => {
    expect(codes(built)).toEqual([
      {
        code: 'operation/invalid-meta',
        at: { operation: 'GET /users/{} @1.1.0' },
        data: { key: 'tags' },
      },
    ])
    expect(
      built.spec({ version: '1.1.0' }).operation('GET /users/{} @1.1.0').tags
    ).toEqual([])
  })
})

describe('filter', () => {
  const PublicProduct = z
    .object({ id: z.number() })
    .meta({ id: 'PublicProduct' })
  const InternalProduct = z
    .object({ id: z.number(), costPrice: z.number() })
    .meta({ id: 'InternalProduct' })
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/products')
        .metaData({ summary: 'List products', public: true })
        .responses({ 200: json(z.array(PublicProduct)) })
    )
    .addRoute(
      Route.post('/products')
        .validate(z.object({ body: z.object({ id: z.number() }) }))
        .metaData({ summary: 'Create product', public: false })
        .responses({ 200: json(PublicProduct) })
    )
    .addRoute(
      Route.get('/internal/products')
        .metaData({ public: 'yes' })
        .responses({ 200: json(z.array(InternalProduct)) })
    )
    .addRoute(
      Route.get('/health').responses({
        200: json(z.object({ ok: z.boolean() })),
      })
    )
    .build()
  const { spec } = pipeline(bag)

  test('passes method, path, version and meta data of every route', () => {
    const filter = vi.fn((_route: unknown) => true)
    spec({ filter })

    expect(filter.mock.calls.map(([route]) => route)).toEqual(
      expect.arrayContaining([
        {
          method: 'GET',
          path: '/products',
          version: '',
          meta: { summary: 'List products', public: true },
        },
        {
          method: 'POST',
          path: '/products',
          version: '',
          meta: { summary: 'Create product', public: false },
        },
        {
          method: 'GET',
          path: '/internal/products',
          version: '',
          meta: { public: 'yes' },
        },
        { method: 'GET', path: '/health', version: '', meta: null },
      ])
    )
    expect(filter).toHaveBeenCalledTimes(4)
  })

  test('excludes rejected routes and the types only they reach', () => {
    const selected = spec({
      filter: ({ meta }) =>
        (meta as { public?: unknown } | null)?.public === true,
    })

    expect(selected.model.operations.map(({ key }) => key)).toEqual([
      'GET /products',
    ])
    expect(selected.operation('GET /products').summary).toBe('List products')
    expect(typeNames(selected.model)).toEqual(['PublicProduct'])
  })

  test('keeps every route without a filter', () => {
    expect(spec().model.operations.map(({ key }) => key)).toEqual([
      'GET /health',
      'GET /internal/products',
      'GET /products',
      'POST /products',
    ])
  })

  test('runs before version resolution, so an older revision can stand in', () => {
    const history = VersionHistory(['2024-01-01', '2025-01-01'] as const)
    const versioned = BagOfRoutes.withVersioning(Versioning.DATE, history)
      .addRoute(
        Route.version('2024-01-01')
          .get('/a')
          .metaData({ public: true })
          .response(204)
      )
      .addRoute(
        Route.version('2025-01-01')
          .get('/a')
          .metaData({ public: false })
          .response(204)
      )
      .build()

    expect(
      pipeline(versioned)
        .spec({
          version: '2025-01-01',
          filter: ({ meta }) => (meta as { public: boolean }).public,
        })
        .model.operations.map(({ key }) => key)
    ).toEqual(['GET /a @2024-01-01'])
  })
})

describe('paths', () => {
  const history = VersionHistory(['2024-01-01'] as const)
  const bag = BagOfRoutes.withVersioning(Versioning.DATE, history)
    .addRoute(
      Route.version('2024-01-01')
        .put('/users/:userId')
        .validate(z.object({ params: z.object({ userId: z.string() }) }))
        .response(204)
    )
    .addRoute(
      Route.version('2024-01-01')
        .get('/users/:id')
        .validate(z.object({ params: z.object({ id: z.string() }) }))
        .response(204)
    )
    .build()

  test('routes whose paths differ only in param names share the first route path in method order', () => {
    const selected = pipeline(bag).spec({ version: '2024-01-01' })

    expect(
      selected.model.operations.map(({ method, path, parameters }) => [
        method,
        path,
        parameters.map(({ name, in: location }) => `${location}:${name}`),
      ])
    ).toEqual([
      ['GET', '/users/:id', ['path:id']],
      ['PUT', '/users/:id', ['path:id']],
    ])
  })
})

describe('operationId', () => {
  test('must be unique within a spec, not across specs', () => {
    const history = VersionHistory(['1.0.0', '2.0.0'] as const)
    const bag = BagOfRoutes.withVersioning(Versioning.SEMVER, history)
      .addRoute(
        Route.version('1.0.0')
          .get('/a')
          .metaData({ operationId: 'read' })
          .response(204)
      )
      .addRoute(
        Route.version('2.0.0')
          .get('/a')
          .metaData({ operationId: 'read' })
          .response(204)
      )
      .addRoute(
        Route.version('2.0.0')
          .get('/b')
          .metaData({ operationId: 'read' })
          .response(204)
      )
      .build()
    const { spec } = pipeline(bag)

    expect(spec({ version: '1.0.0' }).diagnostics).toEqual([])
    expect(codes(spec({ version: '2.0.0' }))).toEqual([
      {
        code: 'operation/duplicate-operation-id',
        at: { operation: 'GET /b @2.0.0' },
        data: {
          operationId: 'read',
          operations: ['GET /a @2.0.0', 'GET /b @2.0.0'],
        },
      },
    ])
  })
})

describe('whole specs', () => {
  const bearer = securityScheme('bearer', { type: 'http', scheme: 'bearer' })
  const Tag = z.object({ name: z.string() }).meta({ id: 'Tag' })
  const Product = z
    .object({
      id: z.number(),
      stock: z.number().default(0),
      tags: z.array(Tag),
    })
    .meta({ id: 'Product' })
  const Audit = z
    .object({ by: z.string(), product: Product })
    .meta({ id: 'Audit' })
  const Failure = z.object({ message: z.string() }).meta({ id: 'Failure' })
  const notFound = json(Failure, {
    id: 'NotFound',
    description: 'No such product',
  })
  const invalid = json(Failure, {
    id: 'Invalid',
    description: 'Invalid product',
  })
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/products/:id')
        .validate(z.object({ params: z.object({ id: z.string() }) }))
        .metaData({ public: true, security: [] })
        .responses({ 200: json(Product), 404: notFound })
    )
    .addRoute(
      Route.put('/products/:id')
        .validate(
          z.object({ params: z.object({ id: z.string() }), body: Product })
        )
        .metaData({ security: [[bearer]] })
        .responses({ 200: json(Audit), 400: invalid, 404: notFound })
    )
    .build()
  const { spec } = pipeline(bag)

  test('a filtered spec keeps only what its operations reach; both share names', async () => {
    const publicSpec = spec({
      filter: ({ meta }) =>
        (meta as { public?: boolean } | null)?.public === true,
    })
    const internalSpec = spec()

    await golden(publicSpec, 'public-spec')
    await golden(internalSpec, 'internal-spec')
  })
})
