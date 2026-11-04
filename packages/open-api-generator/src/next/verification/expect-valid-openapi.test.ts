import { describe, expect, test } from 'vitest'
import { expectValidOpenAPI, OpenAPITarget } from './expect-valid-openapi.js'

const documentFor = (target: OpenAPITarget) => ({
  openapi: `${target}.0`,
  info: { title: 'Pets', version: '1.0.0' },
  paths: {
    '/pets/{id}': {
      get: {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'A pet',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet:
        target === '3.0'
          ? {
              type: 'object',
              properties: { name: { type: 'string', nullable: true } },
            }
          : {
              type: 'object',
              properties: { name: { type: ['string', 'null'] } },
            },
    },
  },
})

const targets: OpenAPITarget[] = ['3.0', '3.1', '3.2']

describe.each(targets)('expectValidOpenAPI for %s', (target) => {
  test('accepts a valid document', () => {
    expect(() => expectValidOpenAPI(documentFor(target), target)).not.toThrow()
  })

  test('rejects a document without info.version with the meta-schema error', () => {
    const document = documentFor(target)
    const { version: _, ...info } = document.info

    expect(() => expectValidOpenAPI({ ...document, info }, target)).toThrow(
      /\/info must have required property 'version'/
    )
  })
})

test('the 3.0 meta-schema checks Schema Objects', () => {
  const document = documentFor('3.0')
  document.components.schemas.Pet = {
    type: 'object',
    properties: { name: { type: ['string', 'null'] } },
  } as never

  expect(() => expectValidOpenAPI(document, '3.0')).toThrow(
    /\/components\/schemas\/Pet\/properties\/name\/type must be string/
  )
})

const withPetSchema = (target: OpenAPITarget, schema: unknown) => {
  const document = documentFor(target)
  document.components.schemas.Pet = schema as never
  return document
}

describe.each(['3.1', '3.2'] as const)('Schema Objects in %s', (target) => {
  test('are validated against JSON Schema 2020-12', () => {
    expect(() =>
      expectValidOpenAPI(withPetSchema(target, { type: 'strng' }), target)
    ).toThrow(
      /\/components\/schemas\/Pet\/type must be equal to one of the allowed values/
    )
  })

  test('are validated below the top level', () => {
    const schema = { type: 'object', properties: { tags: { required: 'x' } } }

    expect(() =>
      expectValidOpenAPI(withPetSchema(target, schema), target)
    ).toThrow(
      /\/components\/schemas\/Pet\/properties\/tags\/required must be array/
    )
  })

  test('are validated in parameters', () => {
    const document = documentFor(target)
    document.paths['/pets/{id}'].get.parameters[0].schema = {
      minLength: 'x',
    } as never

    expect(() => expectValidOpenAPI(document, target)).toThrow(
      /\/paths\/~1pets~1\{id\}\/get\/parameters\/0\/schema\/minLength must be integer/
    )
  })

  test('reject the 3.0 nullable keyword', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string', nullable: true } },
    }

    expect(() =>
      expectValidOpenAPI(withPetSchema(target, schema), target)
    ).toThrow(/\/components\/schemas\/Pet\/properties\/name\/nullable/)
  })

  test('accept a property named nullable', () => {
    const schema = {
      type: 'object',
      properties: { nullable: { type: 'boolean' } },
    }

    expect(() =>
      expectValidOpenAPI(withPetSchema(target, schema), target)
    ).not.toThrow()
  })

  const withParameterComponent = (name: string, schema: unknown) => {
    const document = documentFor(target)
    return {
      ...document,
      components: {
        ...document.components,
        parameters: {
          [name]: { name: 'q', in: 'query', required: true, schema },
        },
      },
    }
  }

  const componentNames = ['example', 'examples', 'x-limit', 'schema']

  test.each(componentNames)(
    'are validated in a parameter component named %s',
    (name) => {
      const document = withParameterComponent(name, { type: 'strng' })

      expect(() => expectValidOpenAPI(document, target)).toThrow(
        `/components/parameters/${name}/schema/type must be equal to one of the allowed values`
      )
    }
  )

  test.each(componentNames)(
    'accept a valid parameter component named %s',
    (name) => {
      const document = withParameterComponent(name, { type: 'string' })

      expect(() => expectValidOpenAPI(document, target)).not.toThrow()
    }
  )

  test('are validated in a header named x-*', () => {
    const document = documentFor(target)
    Object.assign(document.paths['/pets/{id}'].get.responses['200'], {
      headers: { 'x-rate-limit': { schema: { type: 'strng' } } },
    })

    expect(() => expectValidOpenAPI(document, target)).toThrow(
      '/headers/x-rate-limit/schema/type must be equal to one of the allowed values'
    )
  })

  test('reject the 3.0 boolean exclusiveMinimum', () => {
    const schema = { type: 'number', minimum: 0, exclusiveMinimum: true }

    expect(() =>
      expectValidOpenAPI(withPetSchema(target, schema), target)
    ).toThrow(/\/components\/schemas\/Pet\/exclusiveMinimum must be number/)
  })
})

test.each(targets)('a dangling local $ref is rejected in %s', (target) => {
  const document = documentFor(target)
  document.paths['/pets/{id}'].get.responses['200'].content[
    'application/json'
  ].schema.$ref = '#/components/schemas/Nope'

  expect(() => expectValidOpenAPI(document, target)).toThrow(
    /\/paths\/~1pets~1\{id\}\/get\/responses\/200\/content\/application~1json\/schema\/\$ref #\/components\/schemas\/Nope does not resolve/
  )
})

test.each(targets)(
  'a dangling nested schema $ref is rejected in %s',
  (target) => {
    const document = withPetSchema(target, {
      type: 'object',
      properties: { owner: { $ref: '#/components/schemas/Nope' } },
    })

    expect(() => expectValidOpenAPI(document, target)).toThrow(
      '/components/schemas/Pet/properties/owner/$ref #/components/schemas/Nope does not resolve'
    )
  }
)

test.each(targets)(
  'a dangling $ref in an examples map is rejected in %s',
  (target) => {
    const document = documentFor(target)
    Object.assign(
      document.paths['/pets/{id}'].get.responses['200'].content[
        'application/json'
      ],
      { examples: { rex: { $ref: '#/components/examples/Nope' } } }
    )

    expect(() => expectValidOpenAPI(document, target)).toThrow(
      '/application~1json/examples/rex/$ref #/components/examples/Nope does not resolve'
    )
  }
)

test.each(targets)('literal $ref instance data is accepted in %s', (target) => {
  const literal = { $ref: '#/not-a-reference' }
  const document = withPetSchema(target, {
    type: 'object',
    example: literal,
    default: literal,
    enum: [literal],
    'x-payload': literal,
    properties: { name: { type: 'object', example: literal } },
  })
  Object.assign(document.paths['/pets/{id}'].get.parameters[0], {
    example: literal,
  })
  Object.assign(
    document.paths['/pets/{id}'].get.responses['200'].content[
      'application/json'
    ],
    { examples: { rex: { value: literal } } }
  )
  Object.assign(document, { 'x-payload': literal })

  expect(() => expectValidOpenAPI(document, target)).not.toThrow()
})

test.each(['3.1', '3.2'] as const)(
  'a literal $ref in const is accepted in %s',
  (target) => {
    const document = withPetSchema(target, { const: { $ref: '#/nope' } })

    expect(() => expectValidOpenAPI(document, target)).not.toThrow()
  }
)
