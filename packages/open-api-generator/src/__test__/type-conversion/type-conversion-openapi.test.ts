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

const generateSchema = (entryPath: string): GeneratedSchema => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bagOfRoutes = require(entryPath).default

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
    metaData,
    () => true,
    {}
  )
}

const scenario = (name: string) =>
  generateSchema(path.join(__dirname, 'scenarios', `${name}.ts`))

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

const expectAllRefsToResolve = (schema: GeneratedSchema) => {
  const danglingRefs = collectRefs(schema).filter(
    (ref) => !(ref.replace('#/components/schemas/', '') in schema.components)
  )
  expect(danglingRefs).toEqual([])
}

describe('OpenAPI type conversion', () => {
  test('native enums are converted to enum schemas (#20)', () => {
    const schema = scenario('native-enums')
    const response = responseSchema(schema, '/native-enums')

    expect(response.properties.color).toEqual({
      type: 'string',
      enum: ['red', 'blue'],
    })
    expect(response.properties.maybeColor).toEqual({
      type: 'string',
      enum: ['red', 'blue'],
      nullable: true,
    })
    expect(response.properties.priority).toEqual({
      type: 'number',
      enum: [0, 1],
    })
    expectAllRefsToResolve(schema)
  })

  test('generic type aliases are not expanded via apparent properties (#21)', () => {
    const schema = scenario('generic-aliases')
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

  test('nullability is kept outside of direct object properties (#22)', () => {
    const schema = scenario('nullability')
    const body = requestBodySchema(schema, '/nullability')
    const response = responseSchema(schema, '/nullability', 'post')

    expect(body.properties.tags.items).toEqual({
      type: 'string',
      nullable: true,
    })
    expect(response.properties.items.items).toEqual({
      $ref: '#/components/schemas/Item',
      nullable: true,
    })
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
    expect(responseSchema(schema, '/nullable-item')).toEqual({
      $ref: '#/components/schemas/Item',
      nullable: true,
    })
    expectAllRefsToResolve(schema)
  })

  test('nullable unions do not emit a typeless null member (#23)', () => {
    const schema = scenario('nullable-unions')
    const body = requestBodySchema(schema, '/nullable-unions')

    expect(body.properties.flag).toEqual({ type: 'boolean', nullable: true })
    expect(body.properties.choice).toEqual({
      type: 'string',
      enum: ['a', 'b'],
      nullable: true,
    })
    expect(body.properties.mixed).toEqual({
      oneOf: [{ type: 'string' }, { type: 'number' }],
      nullable: true,
    })
    expect(body.properties.boolOrString).toEqual({
      oneOf: [{ type: 'string' }, { type: 'boolean' }],
    })
    expectAllRefsToResolve(schema)
  })

  test('tuples are converted to valid OpenAPI 3.0 arrays (#24)', () => {
    const schema = scenario('tuples')
    const response = responseSchema(schema, '/tuples')

    expect(response.properties.pair).toEqual({
      type: 'array',
      items: {
        oneOf: [{ $ref: '#/components/schemas/Item' }, { type: 'number' }],
      },
      minItems: 2,
      maxItems: 2,
    })
    expect(response.properties.withArray).toEqual({
      type: 'array',
      items: {
        oneOf: [
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
    expect(Object.keys(schema.components).sort()).toEqual(['Item', 'Other'])
    expectAllRefsToResolve(schema)
  })

  test('mixed literal unions keep the type of each literal (#26)', () => {
    const schema = scenario('mixed-literals')
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

  test('named non-object intersections and path params do not leave dangling refs (#30)', () => {
    const schema = scenario('intersections-and-params')

    const response = responseSchema(schema, '/intersections')
    expect(response.properties.first).toEqual(response.properties.second)
    expect(response.properties.first.allOf).toBeDefined()

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
        test(path.relative(__dirname, entryPath), () => {
          expectAllRefsToResolve(generateSchema(entryPath))
        })
      })
  })
})
