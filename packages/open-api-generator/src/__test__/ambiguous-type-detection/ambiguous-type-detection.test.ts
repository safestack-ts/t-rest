import path from 'path'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import type { OpenAPIMetaData } from '../../types/open-api-meta-data'
import type { OpenAPIGeneratorOptions } from '../../types/open-api-generator-options'

import sameShapeBagOfRoutes from './scenarios/ambiguous-type-same-shape'
import differentShapeBagOfRoutes from './scenarios/ambiguous-type-different-shape'
import nullableRefBagOfRoutes from './scenarios/ambiguous-type-nullable-ref'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

const metaData: OpenAPIMetaData = {
  title: 'Ambiguous type test',
  description: 'Ensures duplicate type names with different shapes fail fast.',
  version: '2024-01-01',
}

const filter = () => true

const getSchemaFromBag = (
  bagOfRoutes: any,
  entry: string,
  options?: OpenAPIGeneratorOptions
) =>
  (
    OpenAPIGenerator as unknown as {
      bagOfRoutesToSchema: (
        bagOfRoutes: any,
        entryPath: string,
        tsConfigPath: string,
        metaData: OpenAPIMetaData,
        filter: () => boolean,
        options: OpenAPIGeneratorOptions
      ) => unknown
    }
  ).bagOfRoutesToSchema(
    bagOfRoutes,
    entry,
    tsConfigPath,
    metaData,
    filter,
    options ?? {}
  )

const getComponentKeys = (
  bagOfRoutes: any,
  entry: string,
  options?: OpenAPIGeneratorOptions
) => {
  const schema = getSchemaFromBag(bagOfRoutes, entry, options) as {
    components: Record<string, unknown>
  }
  return Object.keys(schema.components)
}

describe('ambiguous type detection', () => {
  test('does not throw when same type name has equal schema shape', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-same-shape.ts'
    )

    expect(() =>
      getSchemaFromBag(sameShapeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: true,
      })
    ).not.toThrow()
    expect(
      getComponentKeys(sameShapeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: true,
      })
    ).toEqual(
      expect.arrayContaining([
        'CatalogAlpha_ProductCategory',
        'CatalogBeta_ProductCategory',
      ])
    )
  })

  test('does not throw when same short type name has different namespace', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-different-shape.ts'
    )

    expect(() =>
      getSchemaFromBag(differentShapeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: true,
      })
    ).not.toThrow()
    expect(
      getComponentKeys(differentShapeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: true,
      })
    ).toEqual(
      expect.arrayContaining([
        'CatalogAlpha_ProductCategory',
        'CatalogBeta_ProductCategory',
      ])
    )
  })

  test('throws on same short type name with different shapes when namespace is disabled', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-different-shape.ts'
    )

    expect(() =>
      getSchemaFromBag(differentShapeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: false,
      })
    ).toThrow(
      'Ambiguous type(s): ProductCategory. The same resolved component schema name is used with different shapes across routes. Consider renaming one of the TypeScript types or ensure all usages share a single type definition.'
    )
  })

  test('keeps shared component when same short type name has equal schema shape and namespace is disabled', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-same-shape.ts'
    )

    expect(() =>
      getSchemaFromBag(sameShapeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: false,
      })
    ).not.toThrow()

    expect(
      getComponentKeys(sameShapeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: false,
      })
    ).toEqual(expect.arrayContaining(['ProductCategory']))
  })

  test('does not throw when nullable and non-nullable usages share the same named type', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-nullable-ref.ts'
    )

    expect(() => getSchemaFromBag(nullableRefBagOfRoutes, entryPath)).not.toThrow()

    const schema = getSchemaFromBag(nullableRefBagOfRoutes, entryPath) as {
      components: Record<string, { nullable?: boolean }>
    }

    expect(getComponentKeys(nullableRefBagOfRoutes, entryPath)).toEqual(
      expect.arrayContaining(['Address'])
    )
    expect(schema.components.Address.nullable).toBeUndefined()
  })

  test('uses short component name when namespace is disabled', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-nullable-ref.ts'
    )

    const schema = getSchemaFromBag(nullableRefBagOfRoutes, entryPath, {
      includeTypesNamespaceInName: false,
    }) as {
      components: Record<string, { nullable?: boolean }>
    }

    expect(
      getComponentKeys(nullableRefBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: false,
      })
    ).toEqual(expect.arrayContaining(['Address']))
    expect(schema.components.Address.nullable).toBeUndefined()
  })
})
