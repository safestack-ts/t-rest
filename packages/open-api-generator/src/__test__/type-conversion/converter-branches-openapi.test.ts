import { describe, expect, test } from 'vitest'
import Ajv from 'ajv'
import path from 'path'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import {
  IntersectionType,
  LiteralType,
  NullType,
  NumberType,
  StringType,
  UnionType,
} from '../../schema/type-schema'
import type { OpenAPIMetaData } from '../../types/open-api-meta-data'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

const metaData: OpenAPIMetaData = {
  title: 'Converter branches test',
  description: 'Ensures less common TypeScript types are converted correctly.',
  version: '',
}

type GeneratedSchema = {
  paths: Record<string, any>
  components: Record<string, any>
}

const scenario = async (
  name: string,
  meta: OpenAPIMetaData = metaData
): Promise<GeneratedSchema> => {
  const entryPath = path.join(__dirname, 'scenarios', `${name}.ts`)
  const bagOfRoutes = (await import(entryPath)).default

  return (
    OpenAPIGenerator as unknown as {
      bagOfRoutesToSchema: (
        bagOfRoutes: any,
        entryPath: string,
        tsConfigPath: string,
        metaData: OpenAPIMetaData,
        filter: () => boolean,
        options: object
      ) => GeneratedSchema
    }
  ).bagOfRoutesToSchema(
    bagOfRoutes,
    entryPath,
    tsConfigPath,
    meta,
    () => true,
    {}
  )
}

const operation = (schema: GeneratedSchema, routePath: string) =>
  Object.values(schema.paths[routePath])[0] as any

const responseSchema = (schema: GeneratedSchema, routePath: string) =>
  operation(schema, routePath).responses['200'].content['application/json']
    .schema

const requestBodySchema = (schema: GeneratedSchema, routePath: string) =>
  operation(schema, routePath).requestBody.content['application/json'].schema

// validates a value against a generated schema, resolving `#/components/schemas` refs
const accepts = (schema: GeneratedSchema, target: object, value: unknown) => {
  const ajv = new Ajv({ validateFormats: false })
  ajv.addKeyword('components')
  return ajv.validate(
    { ...target, components: { schemas: schema.components } },
    value
  )
}

const NULL_SCHEMA = { type: 'string', enum: [null], nullable: true }
const BINARY = { type: 'string', format: 'binary' }
const BIGINT = { type: 'string', format: 'bigint' }

describe('OpenAPI conversion of less common types', () => {
  test('buffers, typed arrays and other built-in types', async () => {
    const schema = await scenario('built-in-types')

    expect(responseSchema(schema, '/files/{fileId}')).toEqual(BINARY)

    const response = responseSchema(schema, '/built-ins')
    expect(response.properties).toEqual({
      content: BINARY,
      bytes: BINARY,
      raw: BINARY,
      maybeContent: { ...BINARY, nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      boxedAmount: BIGINT,
      amount: BIGINT,
      exactAmount: BIGINT,
      token: {},
      uniqueToken: {},
      readable: { type: 'string', format: 'stream' },
      stream: { type: 'string', format: 'stream' },
      lookup: { type: 'object', additionalProperties: true },
      attachments: {
        type: 'array',
        items: { $ref: '#/components/schemas/Attachment' },
        uniqueItems: true,
      },
      ids: { type: 'array', items: { type: 'number' }, uniqueItems: true },
      pattern: { type: 'string', format: 'regexp' },
      metadata: {},
      extra: {},
    })
    // apparent members of primitives and typed arrays must not become components
    expect(Object.keys(schema.components)).toEqual(['Attachment'])

    expect(requestBodySchema(schema, '/built-ins')).toEqual({
      type: 'object',
      properties: {
        amount: BIGINT,
        tags: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        counts: { type: 'object', additionalProperties: true },
        payload: {},
        anything: {},
      },
      required: ['amount', 'tags', 'counts', 'payload', 'anything'],
    })
    for (const value of ['text', 1, null, [1], { nested: true }]) {
      expect(
        accepts(
          schema,
          requestBodySchema(schema, '/built-ins').properties.payload,
          value
        )
      ).toBe(true)
    }
  })

  test('Record, Pick and Omit over unions and literal unions', async () => {
    const schema = await scenario('utility-types-over-unions')
    const response = responseSchema(schema, '/utility-types')

    expect(response.properties.noKeys).toEqual({
      type: 'object',
      properties: {},
    })
    // Pick and Omit are applied to every member of a union
    expect(response.properties.withoutId).toEqual({
      oneOf: [
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['card'] },
            last4: { type: 'string' },
          },
          required: ['kind', 'last4'],
        },
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['invoice'] },
            dueAt: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['kind', 'dueAt'],
        },
      ],
    })
    expect(response.properties.onlyKind).toEqual({
      oneOf: [
        {
          type: 'object',
          properties: { kind: { type: 'string', enum: ['card'] } },
          required: ['kind'],
        },
        {
          type: 'object',
          properties: { kind: { type: 'string', enum: ['invoice'] } },
          required: ['kind'],
        },
      ],
    })
    // Omit over literal unions removes the omitted literals
    expect(response.properties.openStatuses).toEqual({
      type: 'string',
      enum: ['draft', 'paid'],
    })
    expect(response.properties.byStatus).toEqual({
      type: 'object',
      properties: {
        draft: { type: 'number' },
        paid: { type: 'number' },
        void: { type: 'number' },
      },
      required: ['draft', 'paid', 'void'],
    })
  })

  test('tuples with optional and rest elements', async () => {
    const schema = await scenario('tuple-elements')
    const response = responseSchema(schema, '/tuple-elements')

    expect(response.properties.optional).toEqual({
      type: 'array',
      items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      minItems: 1,
      maxItems: 2,
    })
    expect(accepts(schema, response.properties.optional, ['a'])).toBe(true)
    expect(accepts(schema, response.properties.optional, [])).toBe(false)

    expect(response.properties.rest).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/Coordinate' },
      minItems: 1,
    })
    const coordinate = { lat: 1, lng: 2 }
    expect(
      accepts(schema, response.properties.rest, [
        coordinate,
        coordinate,
        coordinate,
      ])
    ).toBe(true)

    expect(response.properties.leadingRest).toEqual({
      type: 'array',
      items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      minItems: 1,
    })
    expect(response.properties.named).toEqual({
      type: 'array',
      items: { type: 'string', format: 'date-time' },
      minItems: 2,
      maxItems: 2,
    })
    expect(response.properties.readonlyPair).toEqual({
      type: 'array',
      items: { anyOf: [{ type: 'string' }, { type: 'boolean' }] },
      minItems: 2,
      maxItems: 2,
    })

    const body = requestBodySchema(schema, '/tuple-elements')
    expect(body.properties.range).toEqual({
      type: 'array',
      items: { type: 'number' },
      minItems: 1,
      maxItems: 2,
    })
    expect(body.properties.path).toEqual({
      type: 'array',
      items: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      minItems: 1,
    })
  })

  test('intersections with unions, classes and interfaces', async () => {
    const schema = await scenario('intersections-with-unions')
    const response = responseSchema(schema, '/intersections-with-unions')

    const bundle = {
      type: 'object',
      properties: {
        id: { type: 'number' },
        type: { type: 'string', enum: ['bundle'] },
        items: { type: 'array', items: { type: 'string' } },
      },
      required: ['id', 'type', 'items'],
    }
    const single = {
      type: 'object',
      properties: {
        id: { type: 'number' },
        type: { type: 'string', enum: ['single'] },
        item: { type: 'string' },
      },
      required: ['id', 'type', 'item'],
    }
    expect(response.properties.product).toEqual({ oneOf: [bundle, single] })
    expect(response.properties.nullableProduct).toEqual({
      oneOf: [bundle, single, NULL_SCHEMA],
    })
    expect(accepts(schema, response.properties.nullableProduct, null)).toBe(
      true
    )
    expect(response.properties.price).toEqual({
      $ref: '#/components/schemas/Money',
    })
    expect(schema.components.Money).toEqual({
      type: 'object',
      properties: { amount: { type: 'number' }, currency: { type: 'string' } },
      required: ['amount', 'currency'],
    })
    expect(response.properties.labelled).toEqual({
      type: 'object',
      properties: {
        label: { type: 'string' },
        color: { type: 'string', nullable: true },
      },
      required: ['label', 'color'],
    })
  })

  test('enums, computed enum members and literals', async () => {
    const schema = await scenario('enums-and-literals')
    const response = responseSchema(schema, '/enums-and-literals')

    expect(response.properties).toEqual({
      single: { type: 'string', enum: ['only'] },
      computed: { type: 'number' },
      onlyComputed: { type: 'number' },
      direction: { type: 'string', enum: ['up', 'down'] },
      maybeDirection: {
        type: 'string',
        enum: ['up', 'down', null],
        nullable: true,
      },
      literalTrue: { type: 'boolean', enum: [true] },
      mixed: {
        oneOf: [
          { type: 'boolean', enum: [true] },
          { type: 'string', enum: ['a'] },
          { type: 'number', enum: [1] },
        ],
      },
      nothing: NULL_SCHEMA,
      nullableLiteral: { type: 'string', enum: ['a', null], nullable: true },
    })
    expect(accepts(schema, response.properties.mixed, false)).toBe(false)
    expect(Object.keys(schema.components)).toEqual([])
  })

  test('Standard Schema validators without zod', async () => {
    const schema = await scenario('standard-schema-validators')
    const body = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        normalized: { type: 'boolean', enum: [true] },
      },
      required: ['name', 'normalized'],
    }

    // the output type of a validator is read from `~standard.types`, whether optional or not
    expect(requestBodySchema(schema, '/optional-types')).toEqual(body)
    expect(requestBodySchema(schema, '/required-types')).toEqual(body)
    expect(operation(schema, '/untyped').requestBody).toBeUndefined()
  })

  test('header types built from union, intersection and literal definitions', async () => {
    const schema = await scenario('mixed-literals', {
      ...metaData,
      headers: [
        {
          name: 'x-null',
          type: UnionType({ types: [NullType()] }),
        },
        {
          name: 'x-optional-string',
          type: UnionType({ types: [StringType(), NullType()] }),
        },
        {
          name: 'x-anything',
          type: UnionType({ types: [StringType(), { kind: 'unknown' }] }),
        },
        {
          name: 'x-tenant',
          type: {
            ...IntersectionType({
              types: [StringType(), StringType({ minLength: 3 })],
            }),
            nullable: true,
          },
        },
        {
          name: 'x-mode',
          type: { ...LiteralType({ value: 'strict' }), nullable: true },
        },
        {
          name: 'x-limit',
          type: {
            ...UnionType({ types: [NumberType(), NullType()] }),
            nullable: true,
          },
        },
      ],
    })
    const schemasByHeader = Object.fromEntries(
      operation(schema, '/mixed-literals').parameters.map((parameter: any) => [
        parameter.name,
        parameter.schema,
      ])
    )

    expect(schemasByHeader).toEqual({
      'x-null': NULL_SCHEMA,
      'x-optional-string': { type: 'string', nullable: true },
      'x-anything': {},
      'x-tenant': {
        oneOf: [
          { allOf: [{ type: 'string' }, { type: 'string', minLength: 3 }] },
          NULL_SCHEMA,
        ],
      },
      'x-mode': { type: 'string', enum: ['strict', null], nullable: true },
      'x-limit': { type: 'number', nullable: true },
    })
  })

  test('recursive types reached through imports', async () => {
    const schema = await scenario('recursive-types-across-modules')
    const response = responseSchema(schema, '/recursive-across-modules')
    const jsonRef = {
      oneOf: [{ $ref: '#/components/schemas/JSONType' }, NULL_SCHEMA],
    }

    // recursive named unions become components that reference themselves
    expect(schema.components.JSONType.oneOf).toHaveLength(5)
    expect(schema.components.JSONType.oneOf).toEqual(
      expect.arrayContaining([
        { type: 'boolean' },
        { type: 'string' },
        { type: 'number' },
        { type: 'array', items: jsonRef },
        { type: 'object', properties: {}, additionalProperties: jsonRef },
      ])
    )
    expect(response.properties.json).toEqual(jsonRef)
    for (const value of [null, 'a', [1, [true, null]], { a: { b: [1] } }]) {
      expect(accepts(schema, response.properties.json, value)).toBe(true)
    }

    // the inferred output of recursive zod schemas references the named union as well
    const condition =
      response.properties.autoDiscountFilter.properties.condition
    expect(Object.keys(condition.properties)).toEqual(['gt', 'lt', 'equals'])
    expect(condition.properties.gt.oneOf).toContainEqual({
      type: 'array',
      items: jsonRef,
    })
    expect(
      accepts(schema, condition, { gt: { nested: [1, 'a'] }, equals: null })
    ).toBe(true)

    expect(response.properties.treeNode).toEqual({
      $ref: '#/components/schemas/TreeNode',
    })
    expect(schema.components.TreeNode.properties.children).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/TreeNode' },
    })

    // anonymous recursive types have no component to reference, so their recursion
    // is cut off with an unconstrained schema
    const category = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        children: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              children: { type: 'array', items: {} },
            },
            required: ['name', 'children'],
          },
        },
      },
      required: ['name', 'children'],
    }
    expect(response.properties.category).toEqual(category)
    expect(
      requestBodySchema(schema, '/recursive-across-modules').properties.category
    ).toEqual(category)
    expect(response.properties.tree.properties.children.items).toEqual({
      type: 'object',
      properties: {
        value: { type: 'string' },
        children: { type: 'array', items: {} },
      },
      required: ['value', 'children'],
    })
  })
})
