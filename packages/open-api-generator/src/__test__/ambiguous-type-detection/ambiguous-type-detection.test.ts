import path from 'path'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import { OpenAPIMetaData } from '../../types/open-api-meta-data'

import sameShapeBagOfRoutes from './scenarios/ambiguous-type-same-shape'
import differentShapeBagOfRoutes from './scenarios/ambiguous-type-different-shape'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

const metaData: OpenAPIMetaData = {
  title: 'Ambiguous type test',
  description: 'Ensures duplicate type names with different shapes fail fast.',
  version: '2024-01-01',
}

const filter = () => true

const getSchemaFromBag = (bagOfRoutes: typeof sameShapeBagOfRoutes, entry: string) =>
  (
    OpenAPIGenerator as unknown as {
      bagOfRoutesToSchema: (
        bagOfRoutes: typeof sameShapeBagOfRoutes,
        entryPath: string,
        tsConfigPath: string,
        metaData: OpenAPIMetaData,
        filter: () => boolean
      ) => unknown
    }
  ).bagOfRoutesToSchema(bagOfRoutes, entry, tsConfigPath, metaData, filter)

const getComponentKeys = (
  bagOfRoutes: typeof sameShapeBagOfRoutes,
  entry: string
) => {
  const schema = getSchemaFromBag(bagOfRoutes, entry) as {
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

    expect(() => getSchemaFromBag(sameShapeBagOfRoutes, entryPath)).not.toThrow()
    expect(getComponentKeys(sameShapeBagOfRoutes, entryPath)).toEqual(
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
      getSchemaFromBag(differentShapeBagOfRoutes, entryPath)
    ).not.toThrow()
    expect(getComponentKeys(differentShapeBagOfRoutes, entryPath)).toEqual(
      expect.arrayContaining([
        'CatalogAlpha_ProductCategory',
        'CatalogBeta_ProductCategory',
      ])
    )
  })
})
