import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import {
  BagOfRoutes,
  binary,
  empty,
  json,
  Route,
  securityScheme,
  text,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { afterEach, describe, expect, test } from 'vitest'
import YAML from 'yaml'
import { z } from 'zod'
import { expectValidOpenAPI } from '../verification/expect-valid-openapi.js'
import {
  buildOpenAPI,
  OpenAPIGenerationError,
  parseApiModel,
} from '../index.js'

const ProductV1 = z
  .object({ id: z.number(), name: z.string() })
  .meta({ id: 'ProductV1' })
const ProductV2 = z
  .object({ id: z.number(), title: z.string() })
  .meta({ id: 'ProductV2' })
const Failure = z.object({ error: z.string() }).meta({ id: 'Failure' })

const dated = BagOfRoutes.withVersioning(
  Versioning.DATE,
  VersionHistory(['2024-01-01', '2025-01-01'] as const)
)
  .addRoute(
    Route.version('2024-01-01')
      .get('/products')
      .metaData({ public: true, tags: ['products'] })
      .responses({ 200: json(z.array(ProductV1)) })
  )
  .addRoute(
    Route.version('2025-01-01')
      .get('/products')
      .metaData({ public: false })
      .responses({ 200: json(z.array(ProductV2)) })
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/products/:productId/manual')
      .validate(z.object({ params: z.object({ productId: z.string() }) }))
      .responses({
        200: binary('application/pdf'),
        202: text('text/csv'),
        204: empty(),
        404: json(Failure),
      })
  )
  .addRoute(
    Route.version('2025-01-01')
      .get('/stats')
      .metaData({ tags: ['stats'] })
      .responses({ 200: json(z.object({ count: z.int() })) })
  )
  .build()

const info = { title: 'Shop', description: 'The shop API' }

const dirs: string[] = []
const outputDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'build-openapi-'))
  dirs.push(dir)
  return dir
}
afterEach(() =>
  Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })))
)

const pathsOf = (document: object) =>
  Object.keys((document as { paths: object }).paths)
const codes = ({ diagnostics }: { diagnostics: readonly { code: string }[] }) =>
  diagnostics.map(({ code }) => code)

describe('buildOpenAPI', () => {
  test('writes every spec of one call into its directory, in the format of its extension', async () => {
    const dir = await outputDir()
    const build = buildOpenAPI({
      bag: dated,
      info,
      specs: [
        {
          version: '2024-01-01',
          target: '3.0',
          output: path.join(dir, 'public/v1.yaml'),
        },
        {
          target: '3.1',
          output: path.join(dir, 'internal/nested/latest.json'),
        },
      ],
    })

    await build.write()

    expect(await readdir(path.join(dir, 'public'))).toEqual([
      'v1.api-model.json',
      'v1.yaml',
    ])
    const [v1, latest] = build.specs
    expect(
      YAML.parse(await readFile(path.join(dir, 'public/v1.yaml'), 'utf8'))
    ).toEqual(v1.document)
    expect(
      JSON.parse(
        await readFile(path.join(dir, 'internal/nested/latest.json'), 'utf8')
      )
    ).toEqual(latest.document)
    expect(
      parseApiModel(
        JSON.parse(
          await readFile(
            path.join(dir, 'internal/nested/latest.api-model.json'),
            'utf8'
          )
        )
      )
    ).toEqual(latest.model)
    expectValidOpenAPI(v1.document, '3.0')
    expectValidOpenAPI(latest.document, '3.1')
  })

  test('documents each version with the newest revision not newer than it', () => {
    const { specs } = buildOpenAPI({
      bag: dated,
      info,
      specs: [
        { versions: 'all', target: '3.1', output: 'openapi/{version}.yaml' },
      ],
    })
    const [first, second] = specs
    const items = (document: any) =>
      document.paths['/products'].get.responses['200'].content[
        'application/json'
      ].schema.items

    expect(specs.map(({ output }) => output)).toEqual([
      'openapi/2024-01-01.yaml',
      'openapi/2025-01-01.yaml',
    ])
    expect(pathsOf(first.document)).toEqual([
      '/products',
      '/products/{productId}/manual',
    ])
    expect(items(first.document)).toEqual({
      $ref: '#/components/schemas/ProductV1',
    })
    expect(pathsOf(second.document)).toEqual([
      '/products',
      '/products/{productId}/manual',
      '/stats',
    ])
    expect(items(second.document)).toEqual({
      $ref: '#/components/schemas/ProductV2',
    })
    expect((first.document as any).info.version).toBe('2024-01-01')
  })

  test('resolves semantic versions', () => {
    const semver = BagOfRoutes.withVersioning(
      Versioning.SEMVER,
      VersionHistory(['1.0.0', '1.1.0', '2.0.0'] as const)
    )
      .addRoute(Route.version('1.0.0').get('/users').response(204))
      .addRoute(Route.version('1.1.0').get('/users/:userId').response(204))
      .addRoute(Route.version('2.0.0').delete('/users').response(204))
      .build()
    const paths = (version: '1.0.0' | '1.1.0' | '2.0.0') =>
      buildOpenAPI({
        bag: semver,
        info,
        specs: [{ version, target: '3.1', output: 'api.yaml' }],
      }).specs.map(({ document }) => (document as any).paths)[0]

    expect(Object.keys(paths('1.0.0'))).toEqual(['/users'])
    expect(Object.keys(paths('1.1.0'))).toEqual(['/users', '/users/{userId}'])
    expect(Object.keys(paths('2.0.0')['/users'])).toEqual(['get', 'delete'])
  })

  test('the filter sees every revision with its meta, before version resolution', () => {
    const seen: unknown[] = []
    const { specs } = buildOpenAPI({
      bag: dated,
      info,
      specs: [
        {
          version: '2025-01-01',
          target: '3.1',
          output: 'public.yaml',
          filter: (route) => {
            seen.push([route.method, route.path, route.version, route.meta])
            return route.meta.public !== false
          },
        },
      ],
    })

    expect(seen).toEqual([
      ['GET', '/products', '2024-01-01', { public: true, tags: ['products'] }],
      ['GET', '/products', '2025-01-01', { public: false }],
      ['GET', '/products/:productId/manual', '2024-01-01', {}],
      ['GET', '/stats', '2025-01-01', { tags: ['stats'] }],
    ])
    expect(
      (specs[0].document as any).paths['/products'].get.responses['200']
        .content['application/json'].schema.items
    ).toEqual({ $ref: '#/components/schemas/ProductV1' })
  })

  test('emits info, servers and tags, declared tags first', () => {
    const { specs, diagnostics } = buildOpenAPI({
      bag: dated,
      info: {
        ...info,
        version: '3.0.0',
        contact: { email: 'api@shop.dev' },
        license: { name: 'MIT' },
      },
      servers: [{ url: 'https://api.shop.dev' }],
      tags: [{ name: 'orders', description: 'Not used yet' }],
      specs: [{ target: '3.1', output: 'api.yaml' }],
    })
    const document = specs[0].document as any

    expect(document.info).toEqual({
      title: 'Shop',
      description: 'The shop API',
      contact: { email: 'api@shop.dev' },
      license: { name: 'MIT' },
      version: '3.0.0',
    })
    expect(document.servers).toEqual([{ url: 'https://api.shop.dev' }])
    expect(document.tags).toEqual([
      { name: 'orders', description: 'Not used yet' },
      { name: 'stats' },
    ])
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'writer/tag-undeclared',
        at: { spec: 'api.yaml' },
      })
    )
  })

  test('emits one response per declared status with its content type', () => {
    const { specs } = buildOpenAPI({
      bag: dated,
      info,
      specs: [{ version: '2024-01-01', target: '3.0', output: 'api.yaml' }],
    })
    const responses = (specs[0].document as any).paths[
      '/products/{productId}/manual'
    ].get.responses

    expect(responses).toEqual({
      200: {
        description: 'OK',
        content: {
          'application/pdf': { schema: { type: 'string', format: 'binary' } },
        },
      },
      202: {
        description: 'Accepted',
        content: { 'text/csv': { schema: { type: 'string' } } },
      },
      204: { description: 'No Content' },
      404: {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Failure' },
          },
        },
      },
    })
  })

  test('leaves out meta values of the wrong type with a warning', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/users')
          // @ts-expect-error tags is an array of strings
          .metaData({ tags: 'users' })
          .response(204)
      )
      .build()
    const build = buildOpenAPI({
      bag,
      info,
      specs: [{ target: '3.1', output: 'api.yaml' }],
    })

    expect(codes(build)).toEqual(['operation/invalid-meta'])
    expect(
      (build.specs[0].document as any).paths['/users'].get
    ).not.toHaveProperty('tags')
  })

  test('documents extra security schemes in every spec', () => {
    const apiKey = securityScheme('apiKey', {
      type: 'apiKey',
      in: 'header',
      name: 'X-Api-Key',
    })
    const { specs } = buildOpenAPI({
      bag: dated,
      info,
      securitySchemes: [apiKey],
      specs: [{ target: '3.1', output: 'api.yaml' }],
    })

    expect((specs[0].document as any).components.securitySchemes).toEqual({
      apiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
    })
  })

  test('reports models without id', () => {
    const { diagnostics } = buildOpenAPI({
      bag: dated,
      info,
      naming: {
        models: {
          ProductV1,
          Inline: z.object({ id: z.number() }),
          VERSION: '1',
        },
      },
      specs: [{ target: '3.1', output: 'api.yaml' }],
    })

    expect(
      diagnostics
        .filter(({ code }) => code === 'naming/model-without-id')
        .map(({ at, data, severity }) => [at, data, severity])
    ).toEqual([[{ slot: 'naming.models Inline' }, { key: 'Inline' }, 'error']])
  })

  test('reports models without id inside exported namespaces, once each, through cycles', () => {
    const Inline = z.object({ id: z.number() })
    const Customer: Record<string, unknown> = Object.create(null)
    Object.assign(Customer, { ProductV1, Inline, VERSION: '1' })
    Customer.Self = Customer
    const { diagnostics } = buildOpenAPI({
      bag: dated,
      info,
      naming: { models: { Customer, Again: { Customer } } },
      specs: [{ target: '3.1', output: 'api.yaml' }],
    })

    expect(
      diagnostics
        .filter(({ code }) => code === 'naming/model-without-id')
        .map(({ at, data }) => [at, data])
    ).toEqual([
      [{ slot: 'naming.models Customer.Inline' }, { key: 'Customer.Inline' }],
    ])
  })

  test('a response schema with an id at its root is a component', () => {
    const Product = z.object({ name: z.string() }).meta({ id: 'Product' })
    const { specs } = buildOpenAPI({
      bag: BagOfRoutes.withoutVersioning()
        .addRoute(Route.get('/product').responses({ 200: json(Product) }))
        .build(),
      info,
      specs: [{ target: '3.1', output: 'api.yaml' }],
    })
    const document = specs[0].document as any

    expect(
      document.paths['/product'].get.responses['200'].content[
        'application/json'
      ].schema
    ).toEqual({ $ref: '#/components/schemas/Product' })
    expect(Object.keys(document.components.schemas)).toEqual(['Product'])
  })

  test.each([
    ['a version outside the history', { version: '2023-01-01' }],
    ['a version list outside the history', { versions: ['2023-01-01'] }],
    ['an empty version list', { versions: [] }],
  ])('reports %s', (_, versions) => {
    const { diagnostics } = buildOpenAPI({
      bag: dated,
      info,
      specs: [
        { ...(versions as object), target: '3.1', output: '{version}.yaml' },
      ],
    })

    expect(codes({ diagnostics })).toContain('config/spec-version')
  })
})

describe('write', () => {
  const rejected = async (
    build: ReturnType<typeof buildOpenAPI>,
    dir: string
  ) => {
    const error = await build.write().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OpenAPIGenerationError)
    expect(await readdir(dir)).toEqual([])
    return codes(error as OpenAPIGenerationError)
  }

  test.each([
    ['an unknown extension', 'api.txt', {}],
    ['several versions without {version}', 'api.yaml', { versions: 'all' }],
  ] as const)('rejects %s and writes nothing', async (_, file, versions) => {
    const dir = await outputDir()
    const build = buildOpenAPI({
      bag: dated,
      info,
      specs: [{ ...versions, target: '3.1', output: path.join(dir, file) }],
    })

    expect(await rejected(build, dir)).toContain('config/output-template')
  })

  test('rejects {version} in the output of an unversioned bag', async () => {
    const dir = await outputDir()
    const build = buildOpenAPI({
      bag: BagOfRoutes.withoutVersioning()
        .addRoute(Route.get('/').response(204))
        .build(),
      info,
      specs: [{ target: '3.1', output: path.join(dir, '{version}.yaml') }],
    })

    expect(await rejected(build, dir)).toEqual(['config/output-template'])
  })

  test('rejects a model without id inside an exported namespace', async () => {
    const dir = await outputDir()
    const build = buildOpenAPI({
      bag: dated,
      info,
      naming: {
        models: { Customer: { Inline: z.object({ id: z.number() }) } },
      },
      specs: [{ target: '3.1', output: path.join(dir, 'api.yaml') }],
    })

    expect(await rejected(build, dir)).toContain('naming/model-without-id')
  })

  test('rejects a model that cannot convert to JSON Schema', async () => {
    const dir = await outputDir()
    const Validator = {
      '~standard': {
        version: 1,
        vendor: 'custom',
        validate: (value: unknown) => ({ value }),
      },
    }
    const build = buildOpenAPI({
      bag: dated,
      info,
      naming: { models: { Validator } },
      specs: [{ target: '3.1', output: path.join(dir, 'api.yaml') }],
    })

    expect(
      build.diagnostics
        .filter(({ code }) => code === 'schema/no-json-schema')
        .map(({ at, data, severity }) => [at, data, severity])
    ).toEqual([
      [{ slot: 'naming.models Validator' }, { vendor: 'custom' }, 'error'],
    ])
    expect(await rejected(build, dir)).toContain('schema/no-json-schema')
  })

  test('rejects an unrepresentable response with a BigInt example', async () => {
    const dir = await outputDir()
    const build = buildOpenAPI({
      bag: BagOfRoutes.withoutVersioning()
        .addRoute(
          Route.get('/value').responses({
            200: json(z.bigint(), { examples: { one: { value: BigInt(1) } } }),
          })
        )
        .build(),
      info,
      specs: [{ target: '3.1', output: path.join(dir, 'api.json') }],
    })

    expect(await rejected(build, dir)).toContain('schema/unrepresentable')
  })

  test('rejects two specs writing one sidecar', async () => {
    const dir = await outputDir()
    const build = buildOpenAPI({
      bag: dated,
      info,
      specs: [
        { target: '3.1', output: path.join(dir, 'api.yaml') },
        { target: '3.0', output: path.join(dir, 'api.json') },
      ],
    })

    expect(await rejected(build, dir)).toContain('output/path-collision')
  })

  test('raises configurable diagnostics to errors and ignores other overrides', async () => {
    const dir = await outputDir()
    const untyped = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/raw').responses({ 200: json<{ id: number }>() }))
      .build()
    const build = (diagnostics: object) =>
      buildOpenAPI({
        bag: untyped,
        info,
        diagnostics,
        specs: [{ target: '3.1', output: path.join(dir, 'api.yaml') }],
      })

    expect(build({}).diagnostics.map(({ severity }) => severity)).toEqual([
      'warning',
    ])
    expect(
      await rejected(build({ 'response/untyped-json': 'error' }), dir)
    ).toEqual(['response/untyped-json'])
    expect(
      build({
        'naming/duplicate-id': 'warning',
        'response/untyped-json': 'info',
      }).diagnostics.map(({ severity }) => severity)
    ).toEqual(['info'])
  })
})
