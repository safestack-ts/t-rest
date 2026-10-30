import { afterEach, describe, expect, test, vi } from 'vitest'
import { existsSync, promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import YAML from 'yaml'
import { z } from 'zod'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import { OpenAPISpec } from '../../classes/open-api-spec'
import { validateRouteMeta } from '../../schema/route-meta'
import { EnumType, StringType } from '../../schema/type-schema'

import namespacedTypeBagOfRoutes from './scenarios/namespaced-type'
import routeMetaFilterBagOfRoutes from './scenarios/route-meta-filter'
import multiVersionBagOfRoutes from './scenarios/multi-version'
import headersBagOfRoutes from './scenarios/headers'
import unsortedComponentsBagOfRoutes from './scenarios/unsorted-components'
import semverVersionsBagOfRoutes from './scenarios/semver-versions'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

const entry = (scenario: string) =>
  path.join(__dirname, 'scenarios', `${scenario}.ts`)

const temporaryDirectories: string[] = []

const createOutputDir = async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'open-api-generator-generate-')
  )
  temporaryDirectories.push(directory)
  return directory
}

const readSpec = async (filePath: string) =>
  YAML.parse(await fs.readFile(filePath, 'utf8'))

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  )
})

const baseMetaData = {
  title: 'Generate test',
  description: 'Ensures the generate entry point writes a valid spec.',
  version: '1.0.0',
}

describe('OpenAPIGenerator.generate', () => {
  describe('options', () => {
    test('uses the spec level options', async () => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(namespacedTypeBagOfRoutes).withMetaData(
            baseMetaData,
            { includeTypesNamespaceInName: true }
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('namespaced-type'),
          tsConfigPath,
        },
      ])

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      expect(Object.keys(spec.components.schemas)).toEqual([
        'Catalog_ProductCategory',
      ])
    })

    test('per call options take precedence over spec level options', async () => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(namespacedTypeBagOfRoutes).withMetaData(
            baseMetaData,
            { includeTypesNamespaceInName: true }
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('namespaced-type'),
          tsConfigPath,
          options: { includeTypesNamespaceInName: false },
        },
      ])

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      expect(Object.keys(spec.components.schemas)).toEqual(['ProductCategory'])
      expect(
        spec.paths['/categories'].get.responses['200'].content[
          'application/json'
        ].schema
      ).toEqual({
        type: 'array',
        items: { $ref: '#/components/schemas/ProductCategory' },
      })
    })

    test('per call options apply when the spec has none', async () => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(namespacedTypeBagOfRoutes).withMetaData(
            baseMetaData
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('namespaced-type'),
          tsConfigPath,
          options: { includeTypesNamespaceInName: true },
        },
      ])

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      expect(Object.keys(spec.components.schemas)).toEqual([
        'Catalog_ProductCategory',
      ])
    })
  })

  describe('filter', () => {
    const validatePublicRouteMeta = validateRouteMeta.extend({
      public: z.boolean(),
    })

    test('passes method, path, version and meta data of every route', async () => {
      const outputDir = await createOutputDir()
      const filter = vi.fn((_route: unknown) => true)

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(routeMetaFilterBagOfRoutes).withMetaData(
            baseMetaData
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('route-meta-filter'),
          tsConfigPath,
          filter,
        },
      ])

      expect(filter.mock.calls.map(([route]) => route)).toEqual(
        expect.arrayContaining([
          {
            method: 'GET',
            path: '/products',
            version: '',
            metaData: { summary: 'List products', public: true },
          },
          {
            method: 'POST',
            path: '/products',
            version: '',
            metaData: { summary: 'Create product', public: false },
          },
          {
            method: 'GET',
            path: '/internal/products',
            version: '',
            metaData: { public: 'yes' },
          },
          {
            method: 'GET',
            path: '/health',
            version: '',
            metaData: null,
          },
        ])
      )
      expect(filter).toHaveBeenCalledTimes(4)
    })

    test('excludes routes rejected by a meta data validating filter', async () => {
      const outputDir = await createOutputDir()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(routeMetaFilterBagOfRoutes).withMetaData(
            baseMetaData
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('route-meta-filter'),
          tsConfigPath,
          filter: ({ metaData }) => {
            const parsed = validatePublicRouteMeta.safeParse(metaData)
            return parsed.success && parsed.data.public
          },
        },
      ])
      warn.mockRestore()

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      expect(Object.keys(spec.paths)).toEqual(['/products'])
      expect(Object.keys(spec.paths['/products'])).toEqual(['get'])
      // the route meta data is emitted, unknown keys like `public` are stripped
      expect(spec.paths['/products'].get.summary).toBe('List products')
      expect(spec.paths['/products'].get).not.toHaveProperty('public')
      // components of excluded routes are not emitted
      expect(Object.keys(spec.components.schemas)).toEqual(['PublicProduct'])
    })

    test('keeps every route without a filter', async () => {
      const outputDir = await createOutputDir()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(routeMetaFilterBagOfRoutes).withMetaData(
            baseMetaData
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('route-meta-filter'),
          tsConfigPath,
        },
      ])

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      expect(Object.keys(spec.paths).sort()).toEqual([
        '/health',
        '/internal/products',
        '/products',
      ])
      expect(Object.keys(spec.paths['/products'])).toEqual(['get', 'post'])
      // `public: 'yes'` is not part of the route meta schema, but unknown keys
      // are stripped, so the meta data is still valid
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })
  })

  describe('output', () => {
    test.each(['spec.yml', 'spec', 'spec.json'])(
      'rejects output file %s without writing anything',
      async (outputFile) => {
        const outputDir = path.join(await createOutputDir(), 'nested')

        await expect(
          OpenAPIGenerator.generate([
            {
              spec: OpenAPISpec.of(namespacedTypeBagOfRoutes).withMetaData(
                baseMetaData
              ),
              outputFile,
              outputDir,
              entry: entry('namespaced-type'),
              tsConfigPath,
            },
          ])
        ).rejects.toThrow('Output file must end with .yaml')
        expect(existsSync(outputDir)).toBe(false)
      }
    )

    test('creates a nested output directory', async () => {
      const outputDir = path.join(await createOutputDir(), 'a', 'b', 'c')

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(namespacedTypeBagOfRoutes).withMetaData(
            baseMetaData
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('namespaced-type'),
          tsConfigPath,
        },
      ])

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      expect(spec.openapi).toBe('3.0.0')
      expect(Object.keys(spec.paths)).toEqual(['/categories'])
    })

    test('writes every spec of a single call', async () => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate(
        ['2024-01-01', '2025-01-01'].map((version) => ({
          spec: OpenAPISpec.ofVersion(
            multiVersionBagOfRoutes,
            version as '2024-01-01' | '2025-01-01'
          ).withMetaData({
            title: baseMetaData.title,
            description: baseMetaData.description,
          }),
          outputFile: `${version}.yaml`,
          outputDir,
          entry: entry('multi-version'),
          tsConfigPath,
        }))
      )

      expect((await fs.readdir(outputDir)).sort()).toEqual([
        '2024-01-01.yaml',
        '2025-01-01.yaml',
      ])
    })

    test('sorts components by key', async () => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(unsortedComponentsBagOfRoutes).withMetaData(
            baseMetaData
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('unsorted-components'),
          tsConfigPath,
        },
      ])

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      const componentKeys = Object.keys(spec.components.schemas)
      expect(componentKeys).toEqual(['Apple', 'Kiwi', 'Mango', 'Zebra'])
      expect(componentKeys).toEqual([...componentKeys].sort())
    })
  })

  describe('versions', () => {
    const generateVersion = async (
      version: '2024-01-01' | '2025-01-01' | '2026-01-01'
    ) => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.ofVersion(
            multiVersionBagOfRoutes,
            version
          ).withMetaData({
            title: baseMetaData.title,
            description: baseMetaData.description,
          }),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('multi-version'),
          tsConfigPath,
        },
      ])

      return readSpec(path.join(outputDir, 'spec.yaml'))
    }

    const productItems = (spec: any) =>
      spec.paths['/products'].get.responses['200'].content['application/json']
        .schema.items

    test('only contains routes introduced up to the requested version', async () => {
      const spec = await generateVersion('2024-01-01')

      expect(spec.info.version).toBe('2024-01-01')
      expect(Object.keys(spec.paths)).toEqual(['/products'])
      expect(productItems(spec)).toEqual({
        $ref: '#/components/schemas/ProductV1',
      })
      expect(Object.keys(spec.components.schemas)).toEqual(['ProductV1'])
    })

    test('resolves the newest revision not newer than the requested version', async () => {
      const spec = await generateVersion('2025-01-01')

      expect(spec.info.version).toBe('2025-01-01')
      expect(Object.keys(spec.paths).sort()).toEqual(['/orders', '/products'])
      expect(productItems(spec)).toEqual({
        $ref: '#/components/schemas/ProductV1',
      })
      expect(Object.keys(spec.components.schemas)).toEqual([
        'Order',
        'ProductV1',
      ])
    })

    test('uses the latest revision for the latest version', async () => {
      const spec = await generateVersion('2026-01-01')

      expect(spec.info.version).toBe('2026-01-01')
      expect(Object.keys(spec.paths).sort()).toEqual(['/orders', '/products'])
      expect(productItems(spec)).toEqual({
        $ref: '#/components/schemas/ProductV2',
      })
      expect(spec.components.schemas.ProductV2).toEqual({
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'tags'],
      })
      expect(Object.keys(spec.components.schemas)).toEqual([
        'Order',
        'ProductV2',
      ])
    })
  })

  describe('meta data', () => {
    const generateWithHeaders = async () => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(headersBagOfRoutes).withMetaData({
            title: 'Headers test',
            description: 'Global and local headers',
            version: '3.1.4',
            contact: {
              name: 'API Team',
              url: 'https://example.com',
              email: 'api@example.com',
            },
            servers: [
              { url: 'https://api.example.com', description: 'Production' },
            ],
            tags: [{ name: 'greeting', description: 'Greetings' }],
            headers: [
              {
                name: 'accept-language',
                description: 'Language of the response',
                required: false,
                type: EnumType({
                  values: ['de', 'en', 'fr'],
                  type: 'string',
                  name: 'Accepted Language',
                }),
              },
              {
                name: 'x-channel-uuid',
                description: 'UUID of the sales channel',
                type: StringType({ format: 'uuid' }),
              },
            ],
          }),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('headers'),
          tsConfigPath,
        },
      ])

      return readSpec(path.join(outputDir, 'spec.yaml'))
    }

    test('emits info, servers and tags', async () => {
      const spec = await generateWithHeaders()

      expect(spec.openapi).toBe('3.0.0')
      expect(spec.info).toEqual({
        title: 'Headers test',
        description: 'Global and local headers',
        version: '3.1.4',
        contact: {
          name: 'API Team',
          url: 'https://example.com',
          email: 'api@example.com',
        },
      })
      expect(spec.servers).toEqual([
        { url: 'https://api.example.com', description: 'Production' },
      ])
      expect(spec.tags).toEqual([
        { name: 'greeting', description: 'Greetings' },
      ])
    })

    test('adds global headers as header parameters of every operation', async () => {
      const spec = await generateWithHeaders()

      expect(spec.paths['/greeting'].get.parameters).toEqual([
        {
          name: 'accept-language',
          in: 'header',
          description: 'Language of the response',
          required: false,
          schema: { type: 'string', enum: ['de', 'en', 'fr'] },
        },
        {
          name: 'x-channel-uuid',
          in: 'header',
          description: 'UUID of the sales channel',
          required: false,
          schema: { type: 'string', format: 'uuid' },
        },
      ])
    })

    test('route headers take precedence over global headers of the same name', async () => {
      const spec = await generateWithHeaders()

      expect(spec.paths['/greeting/localized'].get.parameters).toEqual([
        {
          name: 'accept-language',
          in: 'header',
          description: 'Only german and french are supported here',
          required: true,
          schema: { type: 'string', enum: ['de', 'fr'] },
        },
        {
          name: 'x-channel-uuid',
          in: 'header',
          description: 'UUID of the sales channel',
          required: false,
          schema: { type: 'string', format: 'uuid' },
        },
      ])
      // route headers are not part of the operation meta data
      expect(spec.paths['/greeting/localized'].get).not.toHaveProperty(
        'headers'
      )
    })

    test('omits contact and defaults servers and tags', async () => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.of(namespacedTypeBagOfRoutes).withMetaData(
            baseMetaData
          ),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('namespaced-type'),
          tsConfigPath,
        },
      ])

      const spec = await readSpec(path.join(outputDir, 'spec.yaml'))
      expect(spec.info).toEqual(baseMetaData)
      expect(spec.servers).toEqual([])
      expect(spec.tags).toEqual([])
      expect(spec.paths['/categories'].get.parameters).toEqual([])
    })
  })

  describe('semantic versions', () => {
    const generateVersion = async (version: '1.0.0' | '1.1.0' | '2.0.0') => {
      const outputDir = await createOutputDir()

      await OpenAPIGenerator.generate([
        {
          spec: OpenAPISpec.ofVersion(
            semverVersionsBagOfRoutes,
            version
          ).withMetaData({
            title: baseMetaData.title,
            description: baseMetaData.description,
          }),
          outputFile: 'spec.yaml',
          outputDir,
          entry: entry('semver-versions'),
          tsConfigPath,
        },
      ])

      return readSpec(path.join(outputDir, 'spec.yaml'))
    }

    test('resolves the newest revision not newer than the requested version', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const initial = await generateVersion('1.0.0')
        expect(Object.keys(initial.paths)).toEqual(['/users'])
        expect(Object.keys(initial.components.schemas)).toEqual(['UserV1'])

        const minor = await generateVersion('1.1.0')
        expect(Object.keys(minor.paths).sort()).toEqual([
          '/users',
          '/users/{userId}',
        ])
        expect(Object.keys(minor.components.schemas)).toEqual(['UserV1'])

        const major = await generateVersion('2.0.0')
        expect(
          major.paths['/users'].get.responses['200'].content['application/json']
            .schema.items
        ).toEqual({ $ref: '#/components/schemas/UserV2' })
      } finally {
        warn.mockRestore()
      }
    })

    test('warns about routes with invalid meta data and omits it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const spec = await generateVersion('1.1.0')

        expect(warn).toHaveBeenCalledWith(
          'Route GET /users/:userId revision 1.1.0 has invalid meta data'
        )
        expect(spec.paths['/users/{userId}'].get.tags).toBeUndefined()
      } finally {
        warn.mockRestore()
      }
    })
  })
})
