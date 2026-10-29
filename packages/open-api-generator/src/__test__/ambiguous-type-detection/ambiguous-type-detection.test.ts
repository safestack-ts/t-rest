import { describe, expect, test } from 'vitest'
import path from 'path'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import type { OpenAPIMetaData } from '../../types/open-api-meta-data'
import type { OpenAPIGeneratorOptions } from '../../types/open-api-generator-options'

import sameShapeBagOfRoutes from './scenarios/ambiguous-type-same-shape'
import differentShapeBagOfRoutes from './scenarios/ambiguous-type-different-shape'
import nullableRefBagOfRoutes from './scenarios/ambiguous-type-nullable-ref'
import esmBarrelQualifiedTypeBagOfRoutes from './scenarios/esm-barrel-qualified-type'
import esmBarrelAggregateEntryBagOfRoutes from './scenarios/esm-barrel-aggregate-entry'
import esmBarrelReexportSharedTypeBagOfRoutes from './scenarios/esm-barrel-reexport-shared-type'
import esmBarrelReexportSharedTypeAdminFirstBagOfRoutes from './scenarios/esm-barrel-reexport-shared-type-admin-first'
import esmBarrelReexportCustomerOnlyBagOfRoutes from './scenarios/esm-barrel-reexport-customer-only'
import esmBarrelReexportTransformedAliasBagOfRoutes from './scenarios/esm-barrel-reexport-transformed-alias'

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

  test('uses ESM barrel export path as schema name when namespace is enabled', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-qualified-type.ts'
    )

    const schema = getSchemaFromBag(
      esmBarrelQualifiedTypeBagOfRoutes,
      entryPath,
      {
        includeTypesNamespaceInName: true,
      }
    ) as {
      components: Record<string, unknown>
      paths: Record<
        string,
        {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      properties: {
                        data: {
                          $ref: string
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      >
    }

    expect(Object.keys(schema.components)).toEqual(
      expect.arrayContaining([
        'V2026_06_09_Admin_Keycard_Keycard',
        'V2026_06_09_Customer_Keycard_Keycard',
      ])
    )
    expect(
      schema.paths['/admin/keycards/{keycardId}'].get.responses['200'].content[
        'application/json'
      ].schema.properties.data.$ref
    ).toBe('#/components/schemas/V2026_06_09_Admin_Keycard_Keycard')
  })

  test('uses short ESM barrel component name when namespace is disabled', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-qualified-type.ts'
    )

    expect(
      getComponentKeys(esmBarrelQualifiedTypeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: false,
      })
    ).toEqual(expect.arrayContaining(['Keycard']))
  })

  test('uses ESM barrel export path when parsed through an aggregate entry', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-aggregate-entry.ts'
    )

    expect(
      getComponentKeys(esmBarrelAggregateEntryBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: true,
      })
    ).toEqual(
      expect.arrayContaining([
        'V2026_06_09_Admin_Keycard_Keycard',
        'V2026_06_09_Customer_Keycard_Keycard',
      ])
    )
  })

  test('names shared types from audience re-exports using route context', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-reexport-shared-type.ts'
    )

    const componentKeys = getComponentKeys(
      esmBarrelReexportSharedTypeBagOfRoutes,
      entryPath,
      {
        includeTypesNamespaceInName: true,
      }
    )

    expect(componentKeys).toEqual(
      expect.arrayContaining([
        'V2026_06_09_Customer_Checkout_DiscountCardRequirement',
        'V2026_06_09_Admin_Checkout_DiscountCardRequirement',
        'V2026_06_09_Customer_Checkout_Checkout',
        'V2026_06_09_Admin_Checkout_Checkout',
      ])
    )
    expect(componentKeys).not.toContain('DiscountCardRequirement')
  })

  test('shared re-export naming is independent of route order', () => {
    const customerFirstEntry = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-reexport-shared-type.ts'
    )
    const adminFirstEntry = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-reexport-shared-type-admin-first.ts'
    )

    const customerFirstKeys = getComponentKeys(
      esmBarrelReexportSharedTypeBagOfRoutes,
      customerFirstEntry,
      { includeTypesNamespaceInName: true }
    ).sort()
    const adminFirstKeys = getComponentKeys(
      esmBarrelReexportSharedTypeAdminFirstBagOfRoutes,
      adminFirstEntry,
      { includeTypesNamespaceInName: true }
    ).sort()

    expect(adminFirstKeys).toEqual(customerFirstKeys)
  })

  test('falls back to short name when audience does not re-export shared type', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-reexport-customer-only.ts'
    )

    const componentKeys = getComponentKeys(
      esmBarrelReexportCustomerOnlyBagOfRoutes,
      entryPath,
      {
        includeTypesNamespaceInName: true,
      }
    )

    expect(componentKeys).toEqual(
      expect.arrayContaining([
        'V2026_06_09_Customer_Checkout_DiscountCardRequirement',
        'DiscountCardRequirement',
      ])
    )
    expect(componentKeys).not.toContain(
      'V2026_06_09_Admin_Checkout_DiscountCardRequirement'
    )
  })

  test('keeps short names when namespace option is disabled for shared re-exports', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-reexport-shared-type.ts'
    )

    expect(
      getComponentKeys(esmBarrelReexportSharedTypeBagOfRoutes, entryPath, {
        includeTypesNamespaceInName: false,
      })
    ).toEqual(expect.arrayContaining(['DiscountCardRequirement', 'Checkout']))
  })

  test('does not treat transforming aliases as shared type re-exports', () => {
    const entryPath = path.join(
      __dirname,
      'scenarios',
      'esm-barrel-reexport-transformed-alias.ts'
    )

    const componentKeys = getComponentKeys(
      esmBarrelReexportTransformedAliasBagOfRoutes,
      entryPath,
      {
        includeTypesNamespaceInName: true,
      }
    )

    expect(componentKeys).toEqual(
      expect.arrayContaining([
        'V2026_06_09_Customer_TransformedCheckout_TransformedDiscountCardRequirement',
      ])
    )
    expect(componentKeys).not.toContain(
      'V2026_06_09_Customer_Checkout_DiscountCardRequirement'
    )
  })
})
