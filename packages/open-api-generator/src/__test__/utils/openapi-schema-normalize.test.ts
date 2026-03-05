import {
  hashOpenAPISchema,
  normalizeOpenAPISchema,
  openAPISchemaShapeEqual,
} from '../../utils/openapi-schema-normalize'

describe('openapi schema normalize', () => {
  test('creates equal hash when properties are in different key order', () => {
    const left = {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    }

    const right = {
      required: ['name', 'id'],
      properties: {
        name: { type: 'string' },
        id: { type: 'number' },
      },
      type: 'object',
    }

    expect(hashOpenAPISchema(left)).toEqual(hashOpenAPISchema(right))
    expect(openAPISchemaShapeEqual(left, right)).toBeTrue()
  })

  test('creates equal hash when required order differs', () => {
    const left = {
      type: 'object',
      properties: {
        id: { type: 'number' },
        title: { type: 'string' },
      },
      required: ['title', 'id'],
    }

    const right = {
      type: 'object',
      properties: {
        id: { type: 'number' },
        title: { type: 'string' },
      },
      required: ['id', 'title'],
    }

    expect(hashOpenAPISchema(left)).toEqual(hashOpenAPISchema(right))
  })

  test('creates different hash when nested shapes differ', () => {
    const left = {
      type: 'object',
      properties: {
        category: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
          required: ['id', 'name'],
        },
      },
      required: ['category'],
    }

    const right = {
      type: 'object',
      properties: {
        category: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            title: { type: 'string' },
          },
          required: ['id', 'title'],
        },
      },
      required: ['category'],
    }

    expect(hashOpenAPISchema(left)).not.toEqual(hashOpenAPISchema(right))
    expect(openAPISchemaShapeEqual(left, right)).toBeFalse()
  })

  test('keeps $ref identity and handles nested oneOf or allOf', () => {
    const left = {
      oneOf: [
        { $ref: '#/components/schemas/ProductCategory' },
        {
          allOf: [
            { type: 'object', properties: { id: { type: 'number' } } },
            {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          ],
        },
      ],
    }

    const right = {
      oneOf: [
        { $ref: '#/components/schemas/ProductCategory' },
        {
          allOf: [
            { properties: { id: { type: 'number' } }, type: 'object' },
            {
              required: ['name'],
              properties: { name: { type: 'string' } },
              type: 'object',
            },
          ],
        },
      ],
    }

    expect(hashOpenAPISchema(left)).toEqual(hashOpenAPISchema(right))
  })

  test('removes undefined keys while normalizing', () => {
    const schema = {
      type: 'string',
      format: undefined,
      nullable: true,
    }

    expect(normalizeOpenAPISchema(schema)).toEqual({
      type: 'string',
      nullable: true,
    })
  })
})
