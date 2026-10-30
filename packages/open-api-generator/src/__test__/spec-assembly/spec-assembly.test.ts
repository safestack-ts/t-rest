import { describe, expect, test } from 'vitest'
import path from 'path'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import type { OpenAPIMetaData } from '../../types/open-api-meta-data'
import type { OpenAPIGeneratorOptions } from '../../types/open-api-generator-options'
import type { OpenAPISchema } from '../../types/open-api-schema'

import sameNameWithinResponseBagOfRoutes from './scenarios/same-name-within-response'
import sameNameAcrossBodyAndResponseBagOfRoutes from './scenarios/same-name-across-body-and-response'
import equivalentTemplatedPathsBagOfRoutes from './scenarios/equivalent-templated-paths'
import multipartBagOfRoutes from './scenarios/multipart'
import reexportUnversionedBagOfRoutes from './scenarios/reexport-unversioned'
import reexportMultipleBagsBagOfRoutes from './scenarios/reexport-multiple-bags'
import reexportValidatorContextBagOfRoutes from './scenarios/reexport-validator-context'
import reexportObjectMemberBagOfRoutes from './scenarios/reexport-object-member'
import reexportObjectMemberCustomerFirstBagOfRoutes from './scenarios/reexport-object-member-customer-first'
import reexportClassMethodBagOfRoutes from './scenarios/reexport-class-method'
import reexportWrappedMemberBagOfRoutes from './scenarios/reexport-wrapped-member'
import reexportWrappedAssignedMemberBagOfRoutes from './scenarios/reexport-wrapped-assigned-member'
import reexportFactoryMemberAdminFirstBagOfRoutes from './scenarios/reexport-factory-member-admin-first'
import reexportFactoryMemberCustomerFirstBagOfRoutes from './scenarios/reexport-factory-member-customer-first'
import reexportFactoryMemberUnusedMutatorBagOfRoutes from './scenarios/reexport-factory-member-unused-mutator'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

const metaData: OpenAPIMetaData = {
  title: 'Spec assembly test',
  description: 'Ensures routes and meta data are assembled into a valid spec.',
  version: '2024-01-01',
}

type GeneratedSchema = {
  paths: Record<string, Record<string, any>>
  components: Record<string, any>
}

const getSchemaFromBag = (
  bagOfRoutes: any,
  scenario: string,
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
      ) => GeneratedSchema
    }
  ).bagOfRoutesToSchema(
    bagOfRoutes,
    path.join(__dirname, 'scenarios', scenario),
    tsConfigPath,
    metaData,
    () => true,
    options ?? {}
  )

const metaDataToSchema = (metaData: OpenAPIMetaData) =>
  (
    OpenAPIGenerator as unknown as {
      metaDataToSchema: (metaData: OpenAPIMetaData) => OpenAPISchema
    }
  ).metaDataToSchema(metaData)

describe('spec assembly', () => {
  describe('meta data', () => {
    test('keeps description and contact in the info object', () => {
      const schema = metaDataToSchema({
        ...metaData,
        contact: {
          name: 'API Team',
          url: 'https://example.com',
          email: 'api@example.com',
        },
      })

      expect(schema.info).toEqual({
        title: 'Spec assembly test',
        description:
          'Ensures routes and meta data are assembled into a valid spec.',
        version: '2024-01-01',
        contact: {
          name: 'API Team',
          url: 'https://example.com',
          email: 'api@example.com',
        },
      })
    })

    test('omits contact when it is not provided', () => {
      expect(metaDataToSchema(metaData).info).not.toHaveProperty('contact')
    })
  })

  describe('same-named types', () => {
    test('throws when same-named types from different modules meet within one response', () => {
      expect(() =>
        getSchemaFromBag(
          sameNameWithinResponseBagOfRoutes,
          'same-name-within-response.ts'
        )
      ).toThrow('Ambiguous type(s): User.')
    })

    test('throws when same-named types meet across body and response of one route', () => {
      expect(() =>
        getSchemaFromBag(
          sameNameAcrossBodyAndResponseBagOfRoutes,
          'same-name-across-body-and-response.ts'
        )
      ).toThrow('Ambiguous type(s): User.')
    })
  })

  describe('multipart routes', () => {
    test('declare their body as multipart/form-data', () => {
      const schema = getSchemaFromBag(multipartBagOfRoutes, 'multipart.ts')

      expect(schema.paths['/uploads'].post.requestBody.content).toEqual({
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        },
      })
    })

    test('declare a request body even without a validated body', () => {
      const schema = getSchemaFromBag(multipartBagOfRoutes, 'multipart.ts')

      expect(schema.paths['/avatar'].post.requestBody.content).toEqual({
        'multipart/form-data': { schema: { type: 'object' } },
      })
    })
  })

  describe('equivalent templated paths', () => {
    test('emits one path item for routes whose paths differ only in parameter names', () => {
      const schema = getSchemaFromBag(
        equivalentTemplatedPathsBagOfRoutes,
        'equivalent-templated-paths.ts'
      )

      expect(Object.keys(schema.paths)).toEqual(['/users/{id}'])
      expect(Object.keys(schema.paths['/users/{id}'])).toEqual(['get', 'put'])
    })

    test('renames path parameters to match the emitted path template', () => {
      const schema = getSchemaFromBag(
        equivalentTemplatedPathsBagOfRoutes,
        'equivalent-templated-paths.ts'
      )
      const pathItem = schema.paths['/users/{id}']

      for (const method of ['get', 'put']) {
        expect(
          pathItem[method].parameters.filter(
            (parameter: { in: string }) => parameter.in === 'path'
          )
        ).toEqual([
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ])
      }
    })
  })

  describe('route naming context', () => {
    test('applies naming context to unversioned routes', () => {
      const schema = getSchemaFromBag(
        reexportUnversionedBagOfRoutes,
        'reexport-unversioned.ts',
        { includeTypesNamespaceInName: true }
      )

      expect(Object.keys(schema.components)).toEqual(
        expect.arrayContaining([
          'V2026_06_09_Customer_Checkout_Checkout',
          'V2026_06_09_Customer_Checkout_DiscountCardRequirement',
        ])
      )
    })

    test('ignores routes of other bags in the program', () => {
      const schema = getSchemaFromBag(
        reexportMultipleBagsBagOfRoutes,
        'reexport-multiple-bags.ts',
        { includeTypesNamespaceInName: true }
      )
      const componentKeys = Object.keys(schema.components)

      expect(componentKeys).toEqual(
        expect.arrayContaining([
          'V2026_06_09_Customer_Checkout_Checkout',
          'V2026_06_09_Customer_Checkout_DiscountCardRequirement',
        ])
      )
      expect(componentKeys).not.toContain('V2026_06_09_Admin_Checkout_Checkout')
    })

    test('does not apply the response naming context to the validator input', () => {
      const schema = getSchemaFromBag(
        reexportValidatorContextBagOfRoutes,
        'reexport-validator-context.ts',
        { includeTypesNamespaceInName: true }
      )
      const operation = schema.paths['/checkouts'].post

      expect(
        operation.requestBody.content['application/json'].schema.$ref
      ).toBe('#/components/schemas/V2026_06_09_Admin_Checkout_Checkout')
      expect(
        operation.responses['200'].content['application/json'].schema.properties
          .data.$ref
      ).toBe('#/components/schemas/V2026_06_09_Customer_Checkout_Checkout')
    })

    test.each([
      ['reexport-object-member.ts', reexportObjectMemberBagOfRoutes],
      [
        'reexport-object-member-customer-first.ts',
        reexportObjectMemberCustomerFirstBagOfRoutes,
      ],
      ['reexport-class-method.ts', reexportClassMethodBagOfRoutes],
      ['reexport-wrapped-member.ts', reexportWrappedMemberBagOfRoutes],
      [
        'reexport-wrapped-assigned-member.ts',
        reexportWrappedAssignedMemberBagOfRoutes,
      ],
      [
        'reexport-factory-member-admin-first.ts',
        reexportFactoryMemberAdminFirstBagOfRoutes,
      ],
      [
        'reexport-factory-member-customer-first.ts',
        reexportFactoryMemberCustomerFirstBagOfRoutes,
      ],
      [
        'reexport-factory-member-unused-mutator.ts',
        reexportFactoryMemberUnusedMutatorBagOfRoutes,
      ],
    ])(
      'only uses the routes of the exported member of a bag container (%s)',
      (scenario, bagOfRoutes) => {
        const schema = getSchemaFromBag(bagOfRoutes, scenario, {
          includeTypesNamespaceInName: true,
        })

        expect(
          schema.paths['/accounts/{accountId}'].get.responses['200'].content[
            'application/json'
          ].schema.properties.data.$ref
        ).toBe('#/components/schemas/V2026_06_09_Customer_Checkout_Checkout')
        expect(Object.keys(schema.components)).not.toContain(
          'V2026_06_09_Admin_Checkout_Checkout'
        )
      }
    )
  })
})
