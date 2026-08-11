import {
  extractNamingContextFromTypeText,
  buildRouteNamingContextKey,
} from '../../utils/route-naming-context'
import {
  isTransparentTypeAliasDeclaration,
  selectReExportForContext,
  type PublicTypeReExport,
} from '../../utils/public-type-reexports'
import ts from 'typescript'

describe('route naming context helpers', () => {
  test('extracts namespace path from wrapped response type text', () => {
    expect(
      extractNamingContextFromTypeText(
        'APIResponse<V2026_06_09.Customer.Checkout.Checkout>'
      )
    ).toBe('V2026_06_09.Customer.Checkout')
  })

  test('builds stable route keys', () => {
    expect(
      buildRouteNamingContextKey('GET', '/customer/checkouts/:checkoutId', '2024-01-01')
    ).toBe('GET:/customer/checkouts/:checkoutId:2024-01-01')
  })
})

describe('public type re-export helpers', () => {
  test('detects transparent and transforming aliases', () => {
    const source = `
      export type Transparent = Shared.Foo
      export type Transformed = Omit<Shared.Foo, 'id'>
    `
    const sourceFile = ts.createSourceFile(
      'aliases.ts',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const aliases = sourceFile.statements.filter(ts.isTypeAliasDeclaration)
    expect(isTransparentTypeAliasDeclaration(aliases[0]!)).toBe(true)
    expect(isTransparentTypeAliasDeclaration(aliases[1]!)).toBe(false)
  })

  test('selects re-export by route naming context', () => {
    const candidates: PublicTypeReExport[] = [
      {
        namespacePath: 'V2026_06_09.Admin.Checkout',
        exportName: 'DiscountCardRequirement',
        qualifiedName:
          'V2026_06_09.Admin.Checkout.DiscountCardRequirement',
      },
      {
        namespacePath: 'V2026_06_09.Customer.Checkout',
        exportName: 'DiscountCardRequirement',
        qualifiedName:
          'V2026_06_09.Customer.Checkout.DiscountCardRequirement',
      },
    ]

    expect(
      selectReExportForContext(candidates, 'V2026_06_09.Customer.Checkout')
        ?.qualifiedName
    ).toBe('V2026_06_09.Customer.Checkout.DiscountCardRequirement')
    expect(
      selectReExportForContext(candidates, 'V2026_06_09.Admin')?.qualifiedName
    ).toBe('V2026_06_09.Admin.Checkout.DiscountCardRequirement')
    expect(selectReExportForContext(candidates, undefined)).toBeUndefined()
  })
})
