import { describe, expect, test } from 'vitest'
import Ajv from 'ajv'
import fs from 'fs'
import path from 'path'
import { OpenAPIGenerator } from '../../classes/open-api-generator'
import { validateTypeDefinition } from '../../schema/type-schema'
import type { OpenAPIMetaData } from '../../types/open-api-meta-data'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

const metaData: OpenAPIMetaData = {
  title: 'Type conversion test',
  description: 'Ensures TypeScript types are converted to valid schemas.',
  version: '2024-01-01',
}

type GeneratedSchema = {
  paths: Record<string, any>
  components: Record<string, any>
}

const generateSchema = async (
  entryPath: string,
  meta: OpenAPIMetaData = metaData
): Promise<GeneratedSchema> => {
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

const scenario = (name: string, meta?: OpenAPIMetaData) =>
  generateSchema(path.join(__dirname, 'scenarios', `${name}.ts`), meta)

const responseSchema = (
  schema: GeneratedSchema,
  routePath: string,
  method = 'get'
) =>
  schema.paths[routePath][method].responses['200'].content['application/json']
    .schema

const requestBodySchema = (
  schema: GeneratedSchema,
  routePath: string,
  method = 'post'
) =>
  schema.paths[routePath][method].requestBody.content['application/json'].schema

const collectRefs = (value: unknown, refs: string[] = []): string[] => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs))
  } else if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, nested]) => {
      if (key === '$ref' && typeof nested === 'string') {
        refs.push(nested)
      } else {
        collectRefs(nested, refs)
      }
    })
  }
  return refs
}

// validates a value against a generated schema, resolving `#/components/schemas` refs
const accepts = (
  schema: GeneratedSchema,
  target: object,
  value: unknown
): boolean => {
  const ajv = new Ajv({ validateFormats: false })
  ajv.addKeyword('components')
  return ajv.validate(
    { ...target, components: { schemas: schema.components } },
    value
  )
}

const NULL_SCHEMA = { type: 'string', enum: [null], nullable: true }

const expectAllRefsToResolve = (schema: GeneratedSchema) => {
  const danglingRefs = collectRefs(schema).filter(
    (ref) => !(ref.replace('#/components/schemas/', '') in schema.components)
  )
  expect(danglingRefs).toEqual([])
}

describe('OpenAPI type conversion', () => {
  test('native enums are converted to enum schemas (#20)', async () => {
    const schema = await scenario('native-enums')
    const response = responseSchema(schema, '/native-enums')

    expect(response.properties.color).toEqual({
      type: 'string',
      enum: ['red', 'blue'],
    })
    expect(response.properties.maybeColor).toEqual({
      type: 'string',
      enum: ['red', 'blue', null],
      nullable: true,
    })
    expect(accepts(schema, response.properties.maybeColor, null)).toBe(true)
    expect(accepts(schema, response.properties.maybeColor, 'red')).toBe(true)
    expect(accepts(schema, response.properties.maybeColor, 'green')).toBe(false)
    expect(response.properties.priority).toEqual({
      type: 'number',
      enum: [0, 1],
    })
    expectAllRefsToResolve(schema)
  })

  test('generic type aliases are not expanded via apparent properties (#21)', async () => {
    const schema = await scenario('generic-aliases')
    const response = responseSchema(schema, '/generic-aliases')

    expect(response.properties.nullableString).toEqual({
      type: 'string',
      nullable: true,
    })
    expect(response.properties.numbers).toEqual({
      type: 'array',
      items: { type: 'number' },
    })
    expect(response.properties.users).toEqual({
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/User' },
        },
        total: { type: 'number' },
      },
      required: ['items', 'total'],
    })
    expect(Object.keys(schema.components)).toEqual(['User'])
    expectAllRefsToResolve(schema)
  })

  test('nullability is kept outside of direct object properties (#22)', async () => {
    const schema = await scenario('nullability')
    const body = requestBodySchema(schema, '/nullability')
    const response = responseSchema(schema, '/nullability', 'post')

    expect(body.properties.tags.items).toEqual({
      type: 'string',
      nullable: true,
    })
    expect(response.properties.items.items).toEqual({
      oneOf: [{ $ref: '#/components/schemas/Item' }, NULL_SCHEMA],
    })
    expect(
      accepts(schema, response.properties.items, [null, { id: 'a' }])
    ).toBe(true)
    expect(accepts(schema, response.properties.items, [{}])).toBe(false)
    expect(response.properties.user.properties.email).toEqual({
      type: 'string',
      nullable: true,
    })
    expect(response.properties.picked.properties.email).toEqual({
      type: 'string',
      nullable: true,
    })
    expect(response.properties.record.additionalProperties).toEqual({
      type: 'number',
      nullable: true,
    })
    expect(response.properties.wrapped.properties.value).toEqual({
      type: 'string',
      nullable: true,
    })
    expect(response.properties.intersection.properties.deletedAt).toEqual({
      type: 'string',
      nullable: true,
    })
    const nullableItem = responseSchema(schema, '/nullable-item')
    expect(nullableItem).toEqual({
      oneOf: [{ $ref: '#/components/schemas/Item' }, NULL_SCHEMA],
    })
    expect(accepts(schema, nullableItem, null)).toBe(true)
    expect(accepts(schema, nullableItem, { id: 'a' })).toBe(true)
    expect(accepts(schema, nullableItem, 'a')).toBe(false)
    expect(schema.components.Item.nullable).toBeUndefined()
    expectAllRefsToResolve(schema)
  })

  test('nullable unions do not emit a typeless null member (#23)', async () => {
    const schema = await scenario('nullable-unions')
    const body = requestBodySchema(schema, '/nullable-unions')

    expect(body.properties.flag).toEqual({ type: 'boolean', nullable: true })
    expect(body.properties.choice).toEqual({
      type: 'string',
      enum: ['a', 'b', null],
      nullable: true,
    })
    expect(body.properties.mixed).toEqual({
      oneOf: [{ type: 'string' }, { type: 'number' }, NULL_SCHEMA],
    })
    expect(body.properties.mixedLiterals).toEqual({
      oneOf: [
        { type: 'number', enum: [1] },
        { type: 'string', enum: ['x'] },
        NULL_SCHEMA,
      ],
    })

    for (const [property, values, rejected] of [
      ['flag', [null, true], 'a'],
      ['choice', [null, 'a'], 'c'],
      ['mixed', [null, 'a', 1], true],
      ['mixedLiterals', [null, 'x', 1], 'y'],
    ] as const) {
      values.forEach((value) =>
        expect(accepts(schema, body.properties[property], value)).toBe(true)
      )
      expect(accepts(schema, body.properties[property], rejected)).toBe(false)
    }
    expect(body.properties.boolOrString).toEqual({
      oneOf: [{ type: 'string' }, { type: 'boolean' }],
    })
    expectAllRefsToResolve(schema)
  })

  test('nullable unions with nullable members accept null exactly once (#23)', async () => {
    const schema = await scenario('nullable-unions', {
      ...metaData,
      headers: [
        {
          name: 'x-choice',
          type: {
            kind: 'union',
            nullable: true,
            types: [
              { kind: 'string', nullable: true },
              { kind: 'number' },
              {
                kind: 'union',
                types: [{ kind: 'boolean' }, { kind: 'null' }],
              },
            ],
          },
        },
      ],
    })
    const header = schema.paths['/nullable-unions'].post.parameters.find(
      (parameter: { name: string }) => parameter.name === 'x-choice'
    ).schema

    expect(header).toEqual({
      oneOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        NULL_SCHEMA,
      ],
    })
    for (const value of [null, 'a', 1, true]) {
      expect(accepts(schema, header, value)).toBe(true)
    }
    expect(accepts(schema, header, {})).toBe(false)
  })

  test('nested unions with overlapping members are not flattened (#23)', async () => {
    const schema = await scenario('nullable-unions', {
      ...metaData,
      headers: [
        {
          name: 'x-choice',
          type: {
            kind: 'union',
            types: [
              { kind: 'string' },
              {
                kind: 'union',
                types: [
                  { kind: 'string', minLength: 1 },
                  { kind: 'string', pattern: '^a' },
                  { kind: 'null' },
                ],
              },
            ],
          },
        },
      ],
    })
    const header = schema.paths['/nullable-unions'].post.parameters.find(
      (parameter: { name: string }) => parameter.name === 'x-choice'
    ).schema

    expect(header).toEqual({
      oneOf: [
        { type: 'string' },
        {
          oneOf: [
            { type: 'string', minLength: 1 },
            { type: 'string', pattern: '^a' },
          ],
        },
        NULL_SCHEMA,
      ],
    })
    for (const value of [null, 'a', '']) {
      expect(accepts(schema, header, value)).toBe(true)
    }
  })

  test('tuples are converted to valid OpenAPI 3.0 arrays (#24)', async () => {
    const schema = await scenario('tuples')
    const response = responseSchema(schema, '/tuples')

    expect(response.properties.pair).toEqual({
      type: 'array',
      items: {
        anyOf: [{ $ref: '#/components/schemas/Item' }, { type: 'number' }],
      },
      minItems: 2,
      maxItems: 2,
    })
    expect(response.properties.withArray).toEqual({
      type: 'array',
      items: {
        anyOf: [
          { $ref: '#/components/schemas/Other' },
          { type: 'array', items: { type: 'number' } },
        ],
      },
      minItems: 2,
      maxItems: 2,
    })
    expect(response.properties.same).toEqual({
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 2,
    })
    // overlapping element schemas must not reject values matching several of them
    expect(accepts(schema, response.properties.overlapping, [2, 1])).toBe(true)
    expect(accepts(schema, response.properties.overlapping, [1, 1])).toBe(true)
    expect(Object.keys(schema.components).sort()).toEqual(['Item', 'Other'])
    expectAllRefsToResolve(schema)
  })

  test('mixed literal unions keep the type of each literal (#26)', async () => {
    const schema = await scenario('mixed-literals')
    const response = responseSchema(schema, '/mixed-literals')

    expect(response.properties.mixed).toEqual({
      oneOf: [
        { type: 'string', enum: ['x'] },
        { type: 'number', enum: [1] },
      ],
    })
    expect(response.properties.strings).toEqual({
      type: 'string',
      enum: ['a', 'b'],
    })
  })

  test('named non-object intersections and path params do not leave dangling refs (#30)', async () => {
    const schema = await scenario('intersections-and-params')

    const response = responseSchema(schema, '/intersections')
    expect(response.properties.first).toEqual(response.properties.second)
    expect(response.properties.first.allOf).toBeDefined()

    expectAllRefsToResolve(schema)
  })

  test('nested named path params share components with responses (#30)', async () => {
    const schema = await scenario('nested-parameter-components')

    expect(responseSchema(schema, '/addresses')).toEqual({
      $ref: '#/components/schemas/Address',
    })
    expect(schema.components.Address.properties.city).toEqual({
      $ref: '#/components/schemas/City',
    })
    expectAllRefsToResolve(schema)
  })

  test('header type definitions keep nullable (#30)', () => {
    expect(
      validateTypeDefinition.parse({ kind: 'string', nullable: true })
    ).toEqual({ kind: 'string', nullable: true })
  })

  describe('every generated $ref points to an existing component', () => {
    const scenarioDirectories = [
      path.join(__dirname, 'scenarios'),
      path.join(__dirname, '../type-parsing/scenarios'),
    ]

    scenarioDirectories
      .flatMap((directory) =>
        fs
          .readdirSync(directory)
          .filter((fileName) => fileName.endsWith('.ts'))
          .map((fileName) => path.join(directory, fileName))
      )
      .forEach((entryPath) => {
        test(path.relative(__dirname, entryPath), async () => {
          expectAllRefsToResolve(await generateSchema(entryPath))
        })
      })
  })
})
