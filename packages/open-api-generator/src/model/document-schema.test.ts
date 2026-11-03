import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, test } from 'vitest'
import {
  ApiModelDocument,
  apiModelJsonSchema,
  parseApiModel,
} from './document-schema.js'
import { MODEL_VERSION } from './version-history.js'

const document: ApiModelDocument = {
  modelVersion: MODEL_VERSION,
  versioning: { kind: 'date', history: ['2024-01-01'] },
  types: {
    Node: {
      kind: 'named',
      id: 'Node',
      direction: 'output',
      shape: {
        kind: 'object',
        fields: [
          {
            name: 'name',
            required: true,
            shape: { kind: 'string', minLength: 1 },
          },
          {
            name: 'children',
            required: true,
            shape: { kind: 'array', items: { kind: 'ref', target: 'Node' } },
          },
          {
            name: 'parent',
            required: false,
            shape: {
              kind: 'union',
              exclusive: false,
              members: [{ kind: 'ref', target: 'Node' }, { kind: 'null' }],
            },
          },
        ],
        additional: false,
        docs: {
          description: 'A tree node',
          extensions: { 'x-internal': true },
        },
      },
    },
  },
  responses: {
    NotFound: { description: 'Not Found', headers: [], content: {} },
  },
  securitySchemes: {
    bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  },
  operations: [
    {
      key: 'GET /nodes/{} @2024-01-01',
      method: 'GET',
      path: '/nodes/:id',
      version: '2024-01-01',
      operationId: 'getNode',
      tags: ['nodes'],
      deprecated: false,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          shape: { kind: 'number', integer: true },
          encoding: 'plain',
        },
      ],
      responses: {
        '200': {
          kind: 'inline',
          response: {
            description: 'OK',
            headers: [
              { name: 'etag', required: false, shape: { kind: 'string' } },
            ],
            content: {
              'application/json': {
                shape: { kind: 'ref', target: 'Node' },
                examples: { leaf: { value: { name: 'a', children: [] } } },
              },
            },
          },
        },
        '404': { kind: 'shared', id: 'NotFound' },
      },
      security: [[{ scheme: 'bearer', scopes: [] }], []],
      extensions: { public: true },
    },
  ],
}

const invalidDocuments: [string, unknown][] = [
  [
    'an unknown shape kind',
    {
      ...document,
      types: {
        X: {
          kind: 'named',
          id: 'X',
          direction: 'output',
          shape: { kind: 'date' },
        },
      },
    },
  ],
  ['an unknown key', { ...document, components: {} }],
  ['another model version', { ...document, modelVersion: MODEL_VERSION + 1 }],
  [
    'a missing security list',
    {
      ...document,
      operations: [{ ...document.operations[0], security: undefined }],
    },
  ],
]

describe('parseApiModel', () => {
  test('returns a valid document unchanged', () => {
    expect(parseApiModel(JSON.parse(JSON.stringify(document)))).toEqual(
      document
    )
  })

  test.each(invalidDocuments)('rejects a document with %s', (_, invalid) => {
    expect(() => parseApiModel(invalid)).toThrow()
  })

  test('rejects a ref whose target is not a key of types', () => {
    expect(() => parseApiModel({ ...document, types: {} })).toThrow(
      /ref target 'Node' is not a key of types/
    )
  })

  test('rejects a shared response that is not a key of responses', () => {
    expect(() => parseApiModel({ ...document, responses: {} })).toThrow(
      /shared response 'NotFound' is not a key of responses/
    )
  })

  test('rejects a security scheme that is not a key of securitySchemes', () => {
    expect(() => parseApiModel({ ...document, securitySchemes: {} })).toThrow(
      /security scheme 'bearer' is not a key of securitySchemes/
    )
  })
})

describe('apiModelJsonSchema', () => {
  const validate = new Ajv2020({ strict: false }).compile(apiModelJsonSchema)

  test('accepts the documents parseApiModel accepts', () => {
    expect(validate(document)).toBe(true)
  })

  test.each(invalidDocuments)('rejects a document with %s', (_, invalid) => {
    expect(validate(JSON.parse(JSON.stringify(invalid)))).toBe(false)
  })
})
