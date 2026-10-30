import { afterEach, describe, expect, test } from 'vitest'
import { mkdtemp, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import YAML from 'yaml'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import { OpenAPISpec } from '../../classes/open-api-spec'
import type {
  CanonicalTypeOwnershipOptions,
  OpenAPIGeneratorOptions,
  RouteNamingContextInput,
} from '../../types/open-api-generator-options'

import canonicalBagOfRoutes from './scenarios/canonical/entry'
import ambiguousBagOfRoutes from './scenarios/ambiguous/entry'
import crossAudienceBagOfRoutes from './scenarios/cross-audience/entry'
import multipleBarrelsBagOfRoutes from './scenarios/multiple-barrels/entry'
import missingOwnerBagOfRoutes from './scenarios/missing-owner/entry'
import inheritedAcrossVersionsBagOfRoutes from './scenarios/inherited-across-versions/entry'
import routeScopedUtilitiesBagOfRoutes from './scenarios/route-scoped-utilities/entry'
import unknownAudienceBagOfRoutes from './scenarios/route-scoped-utilities/unknown-audience-entry'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

// conventions of a consumer with `V<date>.<Audience>.<Model>` namespaces
const ownership: CanonicalTypeOwnershipOptions = {
  namespacePattern:
    /^(?<version>V\d{4}_\d{2}_\d{2})\.(?<audience>Admin|Customer|External|Shared)(\.|$)/,
  sharedAudience: 'Shared',
}

// admin routes `/api/<services>/.../admin/...` are named after the singular service
const deriveAdminNamingContext = ({
  path: routePath,
  version,
  namingContext,
}: RouteNamingContextInput) => {
  if (namingContext.response ?? namingContext.input) {
    return namingContext.response ?? namingContext.input
  }

  const segments = routePath.split('/').filter(Boolean)
  if (segments[0] !== 'api' || !segments[1] || !segments.includes('admin')) {
    return undefined
  }

  const service = segments[1].endsWith('ies')
    ? `${segments[1].slice(0, -3)}y`
    : segments[1].endsWith('s')
    ? segments[1].slice(0, -1)
    : segments[1]
  const serviceName = service
    .split('-')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('')

  return `V${version.replace(/-/g, '_')}.Admin.${serviceName}`
}

const publicOptions: OpenAPIGeneratorOptions = {
  includeTypesNamespaceInName: true,
  canonicalTypeOwnership: ownership,
  deriveRouteNamingContext: deriveAdminNamingContext,
}

const internalOptions: OpenAPIGeneratorOptions = {
  ...publicOptions,
  canonicalTypeOwnership: {
    ...ownership,
    inheritRouteNamespaceForUnownedTypes: true,
    routeScopedTypeModules: /[\\/]query-utilities[\\/]search-opts\.ts$/,
  },
}

type Document = {
  components: { schemas: Record<string, any> }
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const generate = async (
  bagOfRoutes: any,
  scenario: string,
  version: string,
  options: OpenAPIGeneratorOptions
): Promise<Document> => {
  const outputDir = await mkdtemp(
    path.join(os.tmpdir(), 'open-api-canonical-ownership-')
  )
  temporaryDirectories.push(outputDir)

  await OpenAPIGenerator.generate([
    {
      spec: OpenAPISpec.ofVersion(bagOfRoutes, version).withMetaData({
        title: 'Canonical ownership',
        description: 'OpenAPI ownership test fixture',
      }),
      outputFile: 'spec.yaml',
      outputDir,
      entry: path.join(__dirname, 'scenarios', scenario),
      tsConfigPath,
      options,
    },
  ])

  return YAML.parse(await readFile(path.join(outputDir, 'spec.yaml'), 'utf8'))
}

const schemaNames = (document: Document) =>
  Object.keys(document.components.schemas)

const unversionedSchemaNames = (document: Document) =>
  schemaNames(document).filter(
    (name) => !/^V\d{4}_\d{2}_\d{2}_(Admin|Customer|External)_/.test(name)
  )

const unresolvedRefs = (document: Document) => {
  const refs = new Set<string>()
  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collect)
    } else if (value !== null && typeof value === 'object') {
      Object.entries(value).forEach(([key, nested]) => {
        if (key === '$ref' && typeof nested === 'string') {
          refs.add(nested.replace('#/components/schemas/', ''))
        } else {
          collect(nested)
        }
      })
    }
  }
  collect(document)
  return [...refs].filter((ref) => !(ref in document.components.schemas))
}

describe('canonical type ownership', () => {
  test('preserves an earlier public owner through a later consumer and union leaves', async () => {
    const document = await generate(
      canonicalBagOfRoutes,
      'canonical/entry.ts',
      '2026-06-09',
      publicOptions
    )
    const names = schemaNames(document)

    expect(names).toEqual(
      expect.arrayContaining([
        'V2024_01_01_Customer_Checkout_PromoCodeValid',
        'V2024_01_01_Customer_Checkout_PromoCodeInvalid',
        'V2025_02_18_Customer_Product_ProductCategory',
        'V2024_01_01_Customer_Basket_BasketDiscountCard',
        'V2026_06_09_Customer_Discounting_DiscountCard',
        'V2026_06_09_Customer_Order_Order',
      ])
    )
    expect(names.some((name) => name.includes('Order_PromoCode'))).toBe(false)
    expect(names.some((name) => name.startsWith('Checkout_'))).toBe(false)
    expect(names.some((name) => name.includes('Order_ProductCategory'))).toBe(
      false
    )
    expect(unresolvedRefs(document)).toEqual([])
  })

  test('names private nested models after their route owner without changing public model owners', async () => {
    const document = await generate(
      canonicalBagOfRoutes,
      'canonical/entry.ts',
      '2026-06-09',
      internalOptions
    )
    const names = schemaNames(document)

    expect(names).toEqual(
      expect.arrayContaining([
        'V2024_01_01_Customer_Basket_BasketDiscountCard',
        'V2024_01_01_Customer_Checkout_PromoCodeValid',
        'V2026_06_09_Customer_Discounting_DiscountCard',
        'V2026_06_09_Customer_Order_InternalOrderMetadata',
      ])
    )
    expect(names).not.toContain('InternalOrderMetadata')
    expect(unversionedSchemaNames(document)).toEqual([])
    expect(unresolvedRefs(document)).toEqual([])
  })

  test('rejects multiple public owners for the same type', async () => {
    await expect(
      generate(
        ambiguousBagOfRoutes,
        'ambiguous/entry.ts',
        '2026-06-09',
        publicOptions
      )
    ).rejects.toThrow(
      'Ambiguous canonical public type ownership: V2024_01_01.Customer.Checkout.PromoCode, V2024_01_01.Customer.Order.PromoCode'
    )
  })

  test('selects the earliest public owner within the route audience', async () => {
    const names = schemaNames(
      await generate(
        crossAudienceBagOfRoutes,
        'cross-audience/entry.ts',
        '2026-06-09',
        publicOptions
      )
    )

    expect(names).toContain('V2025_02_18_Admin_Account_Person')
    expect(names).not.toContain('V2024_01_01_Customer_Account_Person')
  })

  test('considers every public barrel path of a re-exporting module', async () => {
    const document = await generate(
      multipleBarrelsBagOfRoutes,
      'multiple-barrels/entry.ts',
      '2026-06-09',
      publicOptions
    )
    const names = schemaNames(document)

    expect(names).toContain('V2025_02_18_Admin_Account_Person')
    expect(names).not.toContain('Person')
    expect(names).not.toContain('V2024_01_01_Customer_Account_Person')
    expect(unresolvedRefs(document)).toEqual([])
  })

  test('does not fabricate consumer ownership for a named type without a public owner', async () => {
    const names = schemaNames(
      await generate(
        missingOwnerBagOfRoutes,
        'missing-owner/entry.ts',
        '2026-06-09',
        publicOptions
      )
    )

    expect(names).toContain('UnownedModel')
    expect(names.some((name) => name.includes('Order_UnownedModel'))).toBe(
      false
    )
  })

  test('rejects an unowned type inherited by multiple namespaces', async () => {
    await expect(
      generate(
        missingOwnerBagOfRoutes,
        'missing-owner/entry.ts',
        '2026-06-09',
        internalOptions
      )
    ).rejects.toThrow(
      'Ambiguous canonical public type ownership for UnownedModel'
    )
  })

  test('names an unowned type used by several versions after its first owner', async () => {
    const document = await generate(
      inheritedAcrossVersionsBagOfRoutes,
      'inherited-across-versions/entry.ts',
      '2026-06-09',
      internalOptions
    )
    const names = schemaNames(document)

    expect(names.filter((name) => name.endsWith('_UnownedModel'))).toEqual([
      'V2025_02_18_Customer_Order_UnownedModel',
    ])
    expect(unversionedSchemaNames(document)).toEqual([])
    expect(unresolvedRefs(document)).toEqual([])
  })

  test('keeps generic recursive query utilities route-scoped without losing their constraints', async () => {
    const document = await generate(
      routeScopedUtilitiesBagOfRoutes,
      'route-scoped-utilities/entry.ts',
      '2024-01-01',
      internalOptions
    )
    const schemas = document.components.schemas

    expect(schemaNames(document)).toEqual(
      expect.arrayContaining([
        'V2024_01_01_Admin_Order_CheckSearchOptsComposedType',
        'V2024_01_01_Admin_Capacity_CheckSearchOptsComposedType',
        'V2024_01_01_Admin_Order_SearchOptsEq',
        'V2024_01_01_Admin_Capacity_SearchOptsEq',
      ])
    )
    expect(schemas.V2024_01_01_Admin_Order_SearchOptsEq).toMatchObject({
      properties: {
        operator: { enum: ['eq'] },
        value: {},
        key: { type: 'string' },
      },
      required: ['operator', 'value', 'key'],
    })
    expect(
      schemas.V2024_01_01_Admin_Order_CheckSearchOptsComposedType
    ).toMatchObject({
      properties: {
        OR: {
          items: {
            oneOf: expect.arrayContaining([
              {
                $ref: '#/components/schemas/V2024_01_01_Admin_Order_CheckSearchOptsComposedType',
              },
            ]),
          },
        },
      },
    })
    expect(unversionedSchemaNames(document)).toEqual([])
    expect(unresolvedRefs(document)).toEqual([])
  })

  test('does not guess an audience for a route without a naming context', async () => {
    const document = await generate(
      unknownAudienceBagOfRoutes,
      'route-scoped-utilities/unknown-audience-entry.ts',
      '2024-01-01',
      internalOptions
    )
    const names = schemaNames(document)

    expect(names).toContain('CheckSearchOptsComposedType')
    expect(names.some((name) => name.includes('_CheckSearchOpts'))).toBe(false)
    expect(unresolvedRefs(document)).toEqual([])
  })

  test('keeps contextual re-export naming when canonical ownership is disabled', async () => {
    const names = schemaNames(
      await generate(canonicalBagOfRoutes, 'canonical/entry.ts', '2026-06-09', {
        includeTypesNamespaceInName: true,
      })
    )

    expect(names).toEqual(
      expect.arrayContaining([
        'V2026_06_09_Customer_Order_Order',
        'PromoCodeValid',
        'Catalog_ProductCategory',
        'InternalOrderMetadata',
      ])
    )
    expect(names).not.toContain('V2025_02_18_Customer_Product_ProductCategory')
  })
})
