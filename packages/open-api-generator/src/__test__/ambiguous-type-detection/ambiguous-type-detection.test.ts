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

describe('ambiguous type detection', () => {
  test('does not throw when same type name has equal schema shape', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-same-shape.ts'
    )

    expect(() => getSchemaFromBag(sameShapeBagOfRoutes, entryPath)).not.toThrow()
  })

  test('throws when same type name has different schema shape', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'ambiguous-type-different-shape.ts'
    )

    expect(() => getSchemaFromBag(differentShapeBagOfRoutes, entryPath)).toThrow(
      'Ambiguous type(s): ProductCategory'
    )
    expect(() => getSchemaFromBag(differentShapeBagOfRoutes, entryPath)).toThrow(
      'Consider renaming one of the TypeScript types'
    )
  })
})
