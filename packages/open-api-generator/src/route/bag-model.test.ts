import {
  BagOfRoutes,
  json,
  Route,
  text,
  VersionHistory,
  Versioning,
  ze,
} from '@t-rest/core'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { build, codes, golden } from './golden.js'

const Upload = z
  .object({ id: z.string(), size: z.number() })
  .meta({ id: 'Upload' })
const string = { kind: 'string' } as const
const file = { kind: 'string', contentMediaType: 'application/octet-stream' }

describe('multipart', () => {
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.post('/documents')
        .multipart({
          files: {
            document: { required: true },
            attachments: { multiple: true },
          },
        })
        .validate(
          z.object({
            body: z.object({
              title: z.string(),
              document: z.string().optional(),
            }),
          })
        )
        .responses({ 201: json(Upload) })
    )
    .addRoute(
      Route.put('/avatar')
        .multipart({ files: { avatar: { required: true } } })
        .responses({ 200: json(Upload) })
    )
    .addRoute(
      Route.patch('/documents/:documentId')
        .multipart({ json: true })
        .validate(
          z.object({
            params: z.object({ documentId: z.string() }),
            body: z.object({ title: z.string() }).optional(),
          })
        )
        .responses({ 200: json(Upload) })
    )
    .build()

  test('file parts replace their text fields and merge required', async () => {
    const result = build(bag)
    const body = result.operation('POST /documents').requestBody

    expect(body).toEqual({
      required: true,
      content: {
        'multipart/form-data': {
          shape: {
            kind: 'object',
            fields: [
              { name: 'title', required: true, shape: string },
              { name: 'document', required: true, shape: file },
              {
                name: 'attachments',
                required: false,
                shape: { kind: 'array', items: file },
              },
            ],
          },
          encoding: {
            document: { contentType: 'application/octet-stream' },
            attachments: { contentType: 'application/octet-stream' },
          },
        },
      },
    })
    expect(codes(result)).toEqual([])
    await golden(result.model, 'multipart')
  })

  test('a route without a body slot documents its files, required when one is', () => {
    expect(build(bag).operation('PUT /avatar').requestBody).toEqual({
      required: true,
      content: {
        'multipart/form-data': {
          shape: {
            kind: 'object',
            fields: [{ name: 'avatar', required: true, shape: file }],
          },
          encoding: { avatar: { contentType: 'application/octet-stream' } },
        },
      },
    })
  })

  test('json or multipart documents both media types, required from the body slot', () => {
    const body = build(bag).operation('PATCH /documents/{}').requestBody
    const title = {
      kind: 'object',
      fields: [{ name: 'title', required: true, shape: string }],
    }

    expect(body).toEqual({
      required: false,
      content: {
        'application/json': { shape: title },
        'multipart/form-data': { shape: title },
      },
    })
  })
})

describe('query parameters', () => {
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/search')
        .validate(
          z.object({
            query: z.object({
              filter: ze.jsonObject(z.object({ tag: z.string() })),
              ids: z.array(z.number()).optional(),
              q: z.string(),
            }),
          })
        )
        .responses({ 200: json(z.array(Upload)) })
    )
    .build()

  test('objects and arrays travel as JSON, the JSON text branch is not documented', async () => {
    const result = build(bag)

    expect(result.operation('GET /search').parameters).toEqual([
      {
        name: 'filter',
        in: 'query',
        required: true,
        shape: {
          kind: 'object',
          fields: [{ name: 'tag', required: true, shape: string }],
        },
        encoding: 'json',
      },
      {
        name: 'ids',
        in: 'query',
        required: false,
        shape: { kind: 'array', items: { kind: 'number', integer: false } },
        encoding: 'json',
      },
      {
        name: 'q',
        in: 'query',
        required: true,
        shape: string,
        encoding: 'plain',
      },
    ])
    await golden(result.model, 'query-json')
  })

  test('the JSON text branch is dropped inside nested unions too', () => {
    const Text = z
      .union([
        z.string().meta({ contentMediaType: 'application/json' }),
        z.literal(0),
      ])
      .meta({ id: 'Text' })
    const nested = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/nested')
          .validate(
            z.object({
              query: z.object({
                filter: z.union([Text, z.object({ tag: z.string() })]),
              }),
            })
          )
          .response(204)
      )
      .build()

    expect(build(nested).operation('GET /nested').parameters).toEqual([
      {
        name: 'filter',
        in: 'query',
        required: true,
        shape: {
          kind: 'union',
          exclusive: false,
          members: [
            { kind: 'enum', values: [0] },
            {
              kind: 'object',
              fields: [{ name: 'tag', required: true, shape: string }],
            },
          ],
        },
        encoding: 'json',
      },
    ])
  })

  test('a plain string beside an object is kept and reported', () => {
    const mixed = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/mixed')
          .validate(
            z.object({
              query: z.object({
                filter: z.union([z.string(), z.object({ tag: z.string() })]),
                scope: z.union([z.enum(['all']), z.array(z.number())]),
              }),
            })
          )
          .response(204)
      )
      .build()
    const result = build(mixed)

    expect(result.operation('GET /mixed').parameters).toEqual([
      {
        name: 'filter',
        in: 'query',
        required: true,
        shape: {
          kind: 'union',
          exclusive: false,
          members: [
            string,
            {
              kind: 'object',
              fields: [{ name: 'tag', required: true, shape: string }],
            },
          ],
        },
        encoding: 'json',
      },
      {
        name: 'scope',
        in: 'query',
        required: true,
        shape: {
          kind: 'union',
          exclusive: false,
          members: [
            { kind: 'enum', values: ['all'] },
            { kind: 'array', items: { kind: 'number', integer: false } },
          ],
        },
        encoding: 'json',
      },
    ])
    expect(codes(result)).toEqual(
      ['filter', 'scope'].map((parameter) => ({
        code: 'operation/mixed-query-encoding',
        at: {
          operation: 'GET /mixed',
          slot: 'request',
          pointer: `/properties/query/properties/${parameter}`,
        },
        data: { parameter },
      }))
    )
  })

  test('a union that refers back to itself is flattened once', () => {
    const query = {
      type: 'object',
      properties: {
        query: {
          type: 'object',
          properties: { q: { $ref: '#/$defs/U' } },
          required: ['q'],
        },
      },
      $defs: {
        U: { anyOf: [{ type: 'string' }, { $ref: '#/$defs/U' }] },
      },
    }
    const recursive = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/recursive')
          .validate({
            '~standard': {
              version: 1,
              vendor: 'custom',
              validate: (value: unknown) => ({ value }),
              jsonSchema: { input: () => query, output: () => query },
            },
          })
          .response(204)
      )
      .build()

    expect(build(recursive).operation('GET /recursive').parameters).toEqual([
      {
        name: 'q',
        in: 'query',
        required: true,
        shape: {
          kind: 'ref',
          target: 'anon:GET /recursive#request#/properties/query/properties/q',
        },
        encoding: 'plain',
      },
    ])
  })
})

describe('headers', () => {
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/greeting').responses({ 200: text() }))
    .addRoute(
      Route.get('/greeting/localized')
        .validate(
          z.object({
            headers: z.object({ 'Accept-Language': z.enum(['de', 'fr']) }),
          })
        )
        .responses({
          200: text('text/plain', {
            headers: z.object({ 'x-rate-limit': z.int().optional() }),
          }),
        })
    )
    .build()
  const headers = z.object({
    'accept-language': z.enum(['de', 'en', 'fr']).optional(),
    'x-channel': z.uuid(),
  })

  test('global headers are header parameters of every operation, route headers win', async () => {
    const result = build(bag, { headers })
    const names = (key: string) =>
      result
        .operation(key)
        .parameters.map(({ name, in: location, required }) => [
          name,
          location,
          required,
        ])

    expect(names('GET /greeting')).toEqual([
      ['accept-language', 'header', false],
      ['x-channel', 'header', true],
    ])
    expect(names('GET /greeting/localized')).toEqual([
      ['Accept-Language', 'header', true],
      ['x-channel', 'header', true],
    ])
    await golden(result.model, 'headers')
  })

  test('response headers come from the descriptor', () => {
    const response = build(bag).operation('GET /greeting/localized').responses[
      '200'
    ]

    expect(response).toEqual({
      kind: 'inline',
      response: {
        description: 'OK',
        headers: [
          {
            name: 'x-rate-limit',
            required: false,
            shape: { kind: 'number', integer: true },
          },
        ],
        content: { 'text/plain': { shape: string } },
      },
    })
  })
})

describe('operations', () => {
  test('keys come from the normalized path; one key twice is reported', () => {
    const history = VersionHistory(['2024-01-01', '2025-01-01'] as const)
    const bag = BagOfRoutes.withVersioning(Versioning.DATE, history)
      .addRoute(Route.version('2024-01-01').get('/users/:id').response(204))
      .addRoute(Route.version('2025-01-01').get('/users/:userId').response(204))
      .addRoute(Route.version('2025-01-01').get('/users/:other').response(204))
      .build()
    const result = build(bag)

    expect(
      result.model.operations.map(({ key, path, version }) => [
        key,
        path,
        version,
      ])
    ).toEqual([
      ['GET /users/{} @2024-01-01', '/users/:id', '2024-01-01'],
      ['GET /users/{} @2025-01-01', '/users/:userId', '2025-01-01'],
    ])
    expect(result.model.versioning).toEqual({ kind: 'date', history })
    expect(codes(result)).toEqual([
      {
        code: 'operation/duplicate-route',
        at: { operation: 'GET /users/{} @2025-01-01' },
        data: { paths: ['/users/:userId', '/users/:other'] },
      },
    ])
  })

  test('operationId from meta, else the hook, else derived from method and path', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/users/:userId/files')
          .metaData({ operationId: 'listFiles' })
          .response(204)
      )
      .addRoute(Route.get('/users/:userId').response(204))
      .addRoute(Route.delete('/users/:userId').response(204))
      .addRoute(Route.get('/').response(204))
      .build()
    const ids = (
      operationId?: (route: {
        method: string
        path: string
      }) => string | undefined
    ) =>
      build(bag, { operationId }).model.operations.map((op) => op.operationId)

    expect(ids()).toEqual([
      'deleteUsersByUserId',
      'getRoot',
      'getUsersByUserId',
      'listFiles',
    ])
    expect(
      ids(({ method, path }) =>
        method === 'GET' ? `${method} ${path}` : undefined
      )
    ).toEqual([
      'deleteUsersByUserId',
      'GET /',
      'GET /users/:userId',
      'listFiles',
    ])
  })

  test('route meta becomes operation fields, other JSON keys extensions', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/products')
          .metaData({
            summary: 'List products',
            tags: ['products'],
            deprecated: true,
            externalDocs: { url: 'https://docs.example.com' },
            servers: [
              {
                url: 'https://{region}.example.com',
                variables: { region: { default: 'eu' } },
              },
            ],
            public: true,
            audience: { team: 'catalog' },
            check: () => true,
            since: new Date(0),
          })
          .response(204)
      )
      .build()
    const result = build(bag)
    const {
      parameters: _parameters,
      responses: _responses,
      security: _security,
      ...operation
    } = result.operation('GET /products')

    expect(operation).toEqual({
      key: 'GET /products',
      method: 'GET',
      path: '/products',
      version: '',
      operationId: 'getProducts',
      summary: 'List products',
      tags: ['products'],
      deprecated: true,
      externalDocs: { url: 'https://docs.example.com' },
      servers: [
        {
          url: 'https://{region}.example.com',
          variables: { region: { default: 'eu' } },
        },
      ],
      extensions: { public: true, audience: { team: 'catalog' } },
    })
    expect(codes(result)).toEqual([
      {
        code: 'operation/meta-not-serializable',
        at: { operation: 'GET /products' },
        data: { key: 'check', type: 'function' },
      },
      {
        code: 'operation/meta-not-serializable',
        at: { operation: 'GET /products' },
        data: { key: 'since', type: 'Date' },
      },
    ])
  })

  test('a meta key of the wrong runtime type is left out', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/users')
          // @ts-expect-error the generator checks meta at runtime
          .metaData({ tags: 'users', summary: 'Users' })
          .response(204)
      )
      .build()
    const result = build(bag)

    expect(result.operation('GET /users')).toEqual(
      expect.objectContaining({ summary: 'Users', tags: [] })
    )
    expect(codes(result)).toEqual([
      {
        code: 'operation/invalid-meta',
        at: { operation: 'GET /users' },
        data: { key: 'tags' },
      },
    ])
  })

  test('a cyclic meta value is left out, a shared one is kept', () => {
    const self: Record<string, unknown> = {}
    self.self = self
    const team = { team: 'catalog' }
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/products')
          .metaData({ loop: self, owners: [team, team] })
          .response(204)
      )
      .build()
    const result = build(bag)

    expect(result.operation('GET /products').extensions).toEqual({
      owners: [team, team],
    })
    expect(codes(result)).toEqual([
      {
        code: 'operation/meta-not-serializable',
        at: { operation: 'GET /products' },
        data: { key: 'loop', type: 'cyclic value' },
      },
    ])
  })

  test('one id with two shapes across routes is reported', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/a').responses({ 200: json(Upload) }))
      .addRoute(
        Route.get('/b').responses({
          200: json(z.object({ other: z.string() }).meta({ id: 'Upload' })),
        })
      )
      .build()

    expect(codes(build(bag))).toEqual([
      {
        code: 'naming/duplicate-id',
        at: { operation: 'GET /b', slot: 'response 200' },
        data: { id: 'Upload' },
      },
    ])
  })

  test('a recursive alias and its target read by two routes in either order are one type each', () => {
    const Base: z.ZodType = z
      .object({
        get next(): z.ZodOptional<z.ZodType> {
          return Alias.optional()
        },
      })
      .meta({ id: 'Base' })
    const Alias = Base.meta({ id: 'Alias' })
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/a').responses({
          200: json(z.object({ alias: Alias, base: Base })),
        })
      )
      .addRoute(
        Route.get('/b').responses({
          200: json(z.object({ base: Base, alias: Alias })),
        })
      )
      .build()
    const result = build(bag)

    expect(codes(result)).toEqual([])
    expect(result.model.types).toEqual({
      'output:Alias': {
        kind: 'named',
        id: 'Alias',
        direction: 'output',
        shape: { kind: 'ref', target: 'output:Base' },
      },
      'output:Base': {
        kind: 'named',
        id: 'Base',
        direction: 'output',
        shape: {
          kind: 'object',
          fields: [
            {
              name: 'next',
              required: false,
              shape: { kind: 'ref', target: 'output:Alias' },
            },
          ],
        },
      },
    })
  })

  test('a named type with anonymous recursion read by two routes is one type', () => {
    const Node: z.ZodType<{ value: string; next?: unknown }> = z.object({
      value: z.string(),
      get next() {
        return Node.optional()
      },
    })
    const Tree = z.object({ root: Node }).meta({ id: 'Tree' })
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/a').responses({ 200: json(Tree) }))
      .addRoute(
        Route.get('/b').responses({ 200: json(z.object({ tree: Tree })) })
      )
      .build()
    const result = build(bag)
    const node = 'anon:output:Tree#/properties/root'

    expect(codes(result)).toEqual([])
    expect(result.model.types).toEqual({
      'output:Tree': {
        kind: 'named',
        id: 'Tree',
        direction: 'output',
        shape: {
          kind: 'object',
          fields: [
            {
              name: 'root',
              required: true,
              shape: { kind: 'ref', target: node },
            },
          ],
        },
      },
      [node]: {
        kind: 'anonymous',
        direction: 'output',
        shape: {
          kind: 'object',
          fields: [
            { name: 'value', required: true, shape: string },
            {
              name: 'next',
              required: false,
              shape: { kind: 'ref', target: node },
            },
          ],
        },
      },
    })
  })
})
