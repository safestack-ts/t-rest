import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import type { Direction } from '../model/types.js'
import type { JsonSchemaObject, StandardJSONSchemaSource } from './convert.js'
import { createReaderRun, ReaderRun, readSchema } from './read-schema.js'

const at = { operation: 'GET /x', slot: 'response' }

const read = (
  schema: StandardJSONSchemaSource,
  direction: Direction = 'output',
  run: ReaderRun = createReaderRun()
) => readSchema(schema, { ...at, direction }, run)

const shapeOf = (schema: StandardJSONSchemaSource, direction?: Direction) =>
  read(schema, direction).shape

const fieldShape = (
  schema: StandardJSONSchemaSource,
  direction?: Direction
) => {
  const shape = shapeOf(z.object({ f: schema as z.ZodType }), direction)
  return shape.kind === 'object' ? shape.fields[0]?.shape : shape
}

/** A hand-written Standard JSON Schema, as an unknown library would expose it. */
const source = (
  vendor: string,
  output: JsonSchemaObject | (() => JsonSchemaObject),
  input: JsonSchemaObject | (() => JsonSchemaObject) = output
): StandardJSONSchemaSource => ({
  '~standard': {
    vendor,
    jsonSchema: {
      input: typeof input === 'function' ? input : () => input,
      output: typeof output === 'function' ? output : () => output,
    },
  },
})

const string = { kind: 'string' } as const
const number = { kind: 'number', integer: false } as const

describe('shapes', () => {
  test.each<[string, z.ZodType, unknown]>([
    [
      'nullable as a union with null',
      z.string().nullable(),
      { kind: 'union', exclusive: false, members: [string, { kind: 'null' }] },
    ],
    [
      'a literal as a one-member enum',
      z.literal('x'),
      { kind: 'enum', values: ['x'] },
    ],
    [
      'null outside the enum values',
      z.literal(['a', 1, null]),
      {
        kind: 'union',
        exclusive: false,
        members: [{ kind: 'enum', values: ['a', 1] }, { kind: 'null' }],
      },
    ],
    [
      'enum names from x-enum-varnames',
      z.enum(['a', 'b']).meta({ 'x-enum-varnames': ['A', 'B'] }),
      { kind: 'enum', values: ['a', 'b'], names: ['A', 'B'] },
    ],
    [
      'a numeric enum',
      z.enum({ One: 1, Two: 2 }),
      { kind: 'enum', values: [1, 2] },
    ],
    [
      'a closed tuple with an optional element',
      z.tuple([z.string(), z.number().optional()]),
      { kind: 'tuple', prefix: [string, number], minItems: 1 },
    ],
    [
      'a tuple with a rest element',
      z.tuple([z.string()]).rest(z.number()),
      { kind: 'tuple', prefix: [string], rest: number },
    ],
    [
      'an array with bounds',
      z.array(z.string()).min(1).max(3),
      { kind: 'array', items: string, minItems: 1, maxItems: 3 },
    ],
    [
      'a record',
      z.record(z.string(), z.number()),
      { kind: 'object', fields: [], additional: number, propertyNames: string },
    ],
    [
      'a catchall object',
      z.object({ a: z.string() }).catchall(z.number()),
      {
        kind: 'object',
        fields: [{ name: 'a', required: true, shape: string }],
        additional: number,
      },
    ],
    [
      'a loose object as open',
      z.looseObject({ a: z.string() }),
      {
        kind: 'object',
        fields: [{ name: 'a', required: true, shape: string }],
      },
    ],
    [
      'a union',
      z.union([z.string(), z.number()]),
      { kind: 'union', exclusive: false, members: [string, number] },
    ],
    [
      'a discriminated union as exclusive',
      z.discriminatedUnion('k', [
        z.object({ k: z.literal('a') }),
        z.object({ k: z.literal('b') }),
      ]),
      {
        kind: 'union',
        exclusive: true,
        members: [
          {
            kind: 'object',
            fields: [
              {
                name: 'k',
                required: true,
                shape: { kind: 'enum', values: ['a'] },
              },
            ],
          },
          {
            kind: 'object',
            fields: [
              {
                name: 'k',
                required: true,
                shape: { kind: 'enum', values: ['b'] },
              },
            ],
          },
        ],
      },
    ],
    [
      'number constraints with numeric exclusive bounds',
      z.number().gt(1).lte(5).multipleOf(2),
      {
        kind: 'number',
        integer: false,
        exclusiveMinimum: 1,
        maximum: 5,
        multipleOf: 2,
      },
    ],
    [
      'string constraints',
      z.string().min(1).max(3).regex(/^a/),
      { kind: 'string', minLength: 1, maxLength: 3, pattern: '^a' },
    ],
    [
      'every regex of a string as an intersection',
      z.string().regex(/a/).regex(/b/),
      {
        kind: 'intersection',
        members: [
          string,
          { kind: 'string', pattern: 'a' },
          { kind: 'string', pattern: 'b' },
        ],
      },
    ],
    [
      'a file as a binary string',
      z.file(),
      { kind: 'string', format: 'binary', contentEncoding: 'binary' },
    ],
    ['z.never() (not: {}) as never', z.never(), { kind: 'never' }],
    ['z.unknown() as unknown', z.unknown(), { kind: 'unknown' }],
  ])('reads %s', (_, schema, expected) => {
    expect(fieldShape(schema)).toEqual(expected)
  })

  test('reads the false schema as never', () => {
    expect(
      shapeOf(source('acme', { type: 'object', properties: { gone: false } }))
    ).toEqual({
      kind: 'object',
      fields: [{ name: 'gone', required: false, shape: { kind: 'never' } }],
    })
  })

  test('keeps docs and x-* keys on the node', () => {
    expect(
      fieldShape(
        z.string().meta({
          title: 'T',
          description: 'd',
          examples: ['x'],
          deprecated: true,
          'x-internal': true,
        })
      )
    ).toEqual({
      kind: 'string',
      docs: {
        title: 'T',
        description: 'd',
        examples: ['x'],
        deprecated: true,
        extensions: { 'x-internal': true },
      },
    })
  })

  test('keeps unknown annotation keywords as extensions', () => {
    expect(
      shapeOf(source('acme', { type: 'string', 'acme-hint': 'short' }))
    ).toEqual({
      kind: 'string',
      docs: { extensions: { 'acme-hint': 'short' } },
    })
  })

  test('keeps use-site docs on a ref', () => {
    const Person = z.object({ name: z.string() }).meta({ id: 'Person' })
    expect(fieldShape(Person.default({ name: 'Ada' }), 'input')).toEqual({
      kind: 'ref',
      target: 'input:Person',
      docs: { default: { name: 'Ada' } },
    })
  })
})

describe('directions', () => {
  const withDefault = z.object({ a: z.string().default('x') })

  test('requests read the input conversion', () => {
    expect(shapeOf(withDefault, 'input')).toEqual({
      kind: 'object',
      fields: [
        {
          name: 'a',
          required: false,
          shape: { kind: 'string', docs: { default: 'x' } },
        },
      ],
    })
  })

  test('responses read the output conversion', () => {
    expect(shapeOf(withDefault, 'output')).toEqual({
      kind: 'object',
      fields: [
        {
          name: 'a',
          required: true,
          shape: { kind: 'string', docs: { default: 'x' } },
        },
      ],
    })
  })

  test('named types are keyed by direction', () => {
    const Person = z.object({ name: z.string() }).meta({ id: 'Person' })
    expect(Object.keys(read(Person, 'input').types)).toEqual(['input:Person'])
    expect(Object.keys(read(Person, 'output').types)).toEqual(['output:Person'])
  })
})

describe('normalization rules', () => {
  test('safe-integer-bounds drops the bounds zod adds to every integer', () => {
    expect(fieldShape(z.int())).toEqual({ kind: 'number', integer: true })
    expect(fieldShape(z.int().min(0))).toEqual({
      kind: 'number',
      integer: true,
      minimum: 0,
    })
  })

  test('safe-integer-bounds keeps the bounds of vendors without implied safe integers', () => {
    const bounded = {
      type: 'integer',
      minimum: Number.MIN_SAFE_INTEGER,
      maximum: Number.MAX_SAFE_INTEGER,
    }
    expect(shapeOf(source('acme', bounded))).toEqual({
      kind: 'number',
      integer: true,
      minimum: Number.MIN_SAFE_INTEGER,
      maximum: Number.MAX_SAFE_INTEGER,
    })
  })

  test('open-output-objects keeps a response object open unless it is strict on input', () => {
    expect(
      shapeOf(
        z.object({
          open: z.object({ a: z.string() }),
          strict: z.strictObject({ a: z.string() }),
        })
      )
    ).toEqual({
      kind: 'object',
      fields: [
        {
          name: 'open',
          required: true,
          shape: {
            kind: 'object',
            fields: [{ name: 'a', required: true, shape: string }],
          },
        },
        {
          name: 'strict',
          required: true,
          shape: {
            kind: 'object',
            fields: [{ name: 'a', required: true, shape: string }],
            additional: false,
          },
        },
      ],
    })
  })

  test('open-output-objects pairs output and input objects through their refs', () => {
    const Loose = z.object({
      get n() {
        return Loose.optional()
      },
    })
    const Strict = z.strictObject({
      get m() {
        return Strict.optional()
      },
    })
    const p = 'anon:GET /x#response#/properties/p'
    const q = 'anon:GET /x#response#/properties/q'

    expect(
      read(
        z.object({
          p: z
            .string()
            .transform((value) => JSON.parse(value))
            .pipe(Loose),
          q: Strict,
        })
      )
    ).toEqual({
      shape: {
        kind: 'object',
        fields: [
          { name: 'p', required: true, shape: { kind: 'ref', target: p } },
          { name: 'q', required: true, shape: { kind: 'ref', target: q } },
        ],
      },
      types: {
        [p]: {
          kind: 'anonymous',
          direction: 'output',
          shape: {
            kind: 'object',
            fields: [
              { name: 'n', required: false, shape: { kind: 'ref', target: p } },
            ],
          },
        },
        [q]: {
          kind: 'anonymous',
          direction: 'output',
          shape: {
            kind: 'object',
            fields: [
              { name: 'm', required: false, shape: { kind: 'ref', target: q } },
            ],
            additional: false,
          },
        },
      },
      diagnostics: [],
    })
  })

  test('open-output-objects treats a throwing input conversion as open', () => {
    const closed = {
      type: 'object',
      properties: {},
      additionalProperties: false,
    }
    const schema = source('acme', closed, () => {
      throw new Error('no input')
    })
    expect(shapeOf(schema)).toEqual({ kind: 'object', fields: [] })
  })

  test('readonly-input drops readOnly from requests only', () => {
    const schema = z.object({ a: z.string() }).readonly()
    expect(shapeOf(schema, 'input')).toEqual({
      kind: 'object',
      fields: [{ name: 'a', required: true, shape: string }],
    })
    expect(shapeOf(schema, 'output')).toEqual({
      kind: 'object',
      fields: [{ name: 'a', required: true, shape: string }],
      docs: { readOnly: true },
    })
  })
})

describe('JSON Schema semantics', () => {
  test.each<[string, JsonSchemaObject, unknown]>([
    [
      'a closed tuple without minItems as all-optional',
      { type: 'array', prefixItems: [{ type: 'string' }], items: false },
      { kind: 'tuple', prefix: [string], minItems: 0 },
    ],
    [
      'an open tuple without minItems as all-optional',
      { type: 'array', prefixItems: [{ type: 'string' }] },
      {
        kind: 'tuple',
        prefix: [string],
        rest: { kind: 'unknown' },
        minItems: 0,
      },
    ],
  ])('reads %s', (_, schema, expected) => {
    expect(read(source('acme', schema))).toEqual({
      shape: expected,
      types: {},
      diagnostics: [],
    })
  })
})

describe('unsupported keywords', () => {
  test('drop the keyword and warn that the documented schema is wider', () => {
    const result = read(
      source('acme', {
        type: 'object',
        properties: { a: { type: 'string', not: { const: 'x' } } },
        patternProperties: { '^x-': { type: 'string' } },
        if: { required: ['a'] },
        then: { required: ['b'] },
      })
    )

    expect(result.shape).toEqual({
      kind: 'object',
      fields: [{ name: 'a', required: false, shape: string }],
    })
    expect(
      result.diagnostics.map(({ code, severity, at, data }) => ({
        code,
        severity,
        pointer: at.pointer,
        keyword: data,
      }))
    ).toEqual([
      {
        code: 'schema/unsupported-keyword',
        severity: 'warning',
        pointer: '',
        keyword: { keyword: 'patternProperties' },
      },
      {
        code: 'schema/unsupported-keyword',
        severity: 'warning',
        pointer: '',
        keyword: { keyword: 'if' },
      },
      {
        code: 'schema/unsupported-keyword',
        severity: 'warning',
        pointer: '',
        keyword: { keyword: 'then' },
      },
      {
        code: 'schema/unsupported-keyword',
        severity: 'warning',
        pointer: '/properties/a',
        keyword: { keyword: 'not' },
      },
    ])
  })
})

describe('conversion failures', () => {
  const withDate = z.object({ at: z.date(), name: z.string() })

  test('a response part zod cannot represent is an error, documented as unknown', () => {
    const result = read(withDate)

    expect(result.shape).toEqual({
      kind: 'object',
      fields: [
        { name: 'at', required: true, shape: { kind: 'unknown' } },
        { name: 'name', required: true, shape: string },
      ],
    })
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'schema/unrepresentable',
        severity: 'error',
        at,
        data: {
          error: 'Date cannot be represented in JSON Schema',
          placeholders: ['/properties/at'],
        },
      }),
    ])
    expect(result.diagnostics[0]?.message).toMatch(
      /possible placeholders at \/properties\/at \(https:\/\/.+#schemaunrepresentable\)$/
    )
  })

  test('a request part zod cannot represent is a warning', () => {
    expect(
      read(withDate, 'input').diagnostics.map((d) => [d.code, d.severity])
    ).toEqual([['schema/unrepresentable-request', 'warning']])
  })

  test('request placeholders that are all multipart file fields are info', () => {
    const upload = z.object({
      body: z.object({ document: z.custom<Blob>(), title: z.string() }),
    })
    const result = readSchema(
      upload,
      {
        ...at,
        slot: 'request',
        direction: 'input',
        multipartFiles: ['document'],
      },
      createReaderRun()
    )
    expect(result.diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['schema/multipart-placeholder', 'info'],
    ])
  })

  test('a placeholder named like a file field outside the body is a warning', () => {
    const upload = z.object({
      body: z.object({ title: z.string() }),
      query: z.object({ document: z.custom<Blob>() }),
    })
    const result = readSchema(
      upload,
      {
        ...at,
        slot: 'request',
        direction: 'input',
        multipartFiles: ['document'],
      },
      createReaderRun()
    )
    expect(result.diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['schema/unrepresentable-request', 'warning'],
    ])
  })

  test('placeholders of a multiple file field in a named body are info', () => {
    const Upload = z
      .object({ documents: z.array(z.custom<Blob>()) })
      .meta({ id: 'Upload' })
    const result = readSchema(
      z.object({ body: Upload }).meta({ id: 'UploadRequest' }),
      {
        ...at,
        slot: 'request',
        direction: 'input',
        multipartFiles: ['documents'],
      },
      createReaderRun()
    )
    expect(result.diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['schema/multipart-placeholder', 'info'],
    ])
  })

  test('a vendor without a lenient mode fails the conversion', () => {
    const throwing = source('acme', () => {
      throw new Error('boom')
    })
    const result = read(throwing)
    expect(result.shape).toEqual({ kind: 'unknown' })
    expect(result.diagnostics.map((d) => [d.code, d.data])).toEqual([
      ['schema/conversion-failed', { error: 'boom' }],
    ])
  })

  test('a schema without ~standard.jsonSchema is an error', () => {
    const result = read({ '~standard': { vendor: 'acme' } })
    expect(result.diagnostics.map((d) => [d.code, d.severity, d.data])).toEqual(
      [['schema/no-json-schema', 'error', { vendor: 'acme' }]]
    )
  })

  test("zod's duplicate id throw is a naming error, not a conversion failure", () => {
    const first = z.object({ a: z.string() }).meta({ id: 'Dup' })
    const second = z.object({ b: z.string() }).meta({ id: 'Dup' })
    const result = read(z.object({ first, second }))
    expect(result.diagnostics.map((d) => [d.code, d.data])).toEqual([
      ['naming/duplicate-id', { id: 'Dup' }],
    ])
  })
})

describe('conversion cache', () => {
  const counting = () => {
    const calls: Direction[] = []
    const json = { type: 'string' }
    const schema: StandardJSONSchemaSource = {
      '~standard': {
        vendor: 't-rest',
        jsonSchema: {
          input: () => (calls.push('input'), json),
          output: () => (calls.push('output'), json),
        },
      },
    }
    return { schema, calls }
  }

  test('converts a schema once per direction and run', () => {
    const { schema, calls } = counting()
    const run = createReaderRun()

    read(schema, 'input', run)
    read(schema, 'input', run)
    read(schema, 'output', run)
    read(schema, 'output', run)

    expect(calls).toEqual(['input', 'output'])
  })

  test('a new run converts again', () => {
    const { schema, calls } = counting()

    read(schema, 'input', createReaderRun())
    read(schema, 'input', createReaderRun())

    expect(calls).toEqual(['input', 'input'])
  })
})

describe('vendor policies', () => {
  const withDefs = {
    type: 'object',
    properties: { owner: { $ref: '#/$defs/Person' } },
    required: ['owner'],
    $defs: {
      Person: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  }
  const person = {
    kind: 'object',
    fields: [{ name: 'name', required: true, shape: string }],
  }

  test('an unknown vendor is inlined: its def keys are not ids', () => {
    expect(read(source('acme', withDefs))).toEqual({
      shape: {
        kind: 'object',
        fields: [{ name: 'owner', required: true, shape: person }],
      },
      types: {},
      diagnostics: [],
    })
  })

  test('config.vendors.trust makes an unknown vendor trusted', () => {
    expect(
      read(
        source('acme', withDefs),
        'output',
        createReaderRun({ trustedVendors: ['acme'] })
      )
    ).toEqual({
      shape: {
        kind: 'object',
        fields: [
          {
            name: 'owner',
            required: true,
            shape: { kind: 'ref', target: 'output:Person' },
          },
        ],
      },
      types: {
        'output:Person': {
          kind: 'named',
          id: 'Person',
          direction: 'output',
          shape: person,
        },
      },
      diagnostics: [],
    })
  })

  test('an inline vendor keeps recursion as an anonymous type keyed by first use', () => {
    const recursive = {
      type: 'object',
      properties: { tree: { $ref: '#/$defs/Tree' } },
      required: ['tree'],
      $defs: {
        Tree: {
          type: 'object',
          properties: {
            children: { type: 'array', items: { $ref: '#/$defs/Tree' } },
          },
        },
      },
    }
    const key = 'anon:GET /x#response#/properties/tree'

    expect(read(source('arktype', recursive))).toEqual({
      shape: {
        kind: 'object',
        fields: [
          { name: 'tree', required: true, shape: { kind: 'ref', target: key } },
        ],
      },
      types: {
        [key]: {
          kind: 'anonymous',
          direction: 'output',
          shape: {
            kind: 'object',
            fields: [
              {
                name: 'children',
                required: false,
                shape: { kind: 'array', items: { kind: 'ref', target: key } },
              },
            ],
          },
        },
      },
      diagnostics: [],
    })
  })

  test('$ref "#" resolves to the converted root', () => {
    const tree = {
      type: 'object',
      properties: {
        label: { type: 'string' },
        children: { type: 'array', items: { $ref: '#' } },
      },
      required: ['label'],
    }
    const key = 'anon:GET /x#response#'

    expect(read(source('acme', tree))).toEqual({
      shape: { kind: 'ref', target: key },
      types: {
        [key]: {
          kind: 'anonymous',
          direction: 'output',
          shape: {
            kind: 'object',
            fields: [
              { name: 'label', required: true, shape: string },
              {
                name: 'children',
                required: false,
                shape: { kind: 'array', items: { kind: 'ref', target: key } },
              },
            ],
          },
        },
      },
      diagnostics: [],
    })
  })
})
