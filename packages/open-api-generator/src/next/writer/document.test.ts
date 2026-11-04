import { BagOfRoutes, empty, json, Route } from '@t-rest/core'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { serialize } from '../output/serialize.js'
import type { AnonymousContext } from '../naming/anonymous.js'
import { pipeline } from '../spec/testing.js'
import { expectValidOpenAPI } from '../verification/expect-valid-openapi.js'
import { CAPABILITIES, Target, TARGETS } from './capabilities.js'
import { writeDocument } from './document.js'
import { documentSnapshot, instanceValidator } from './testing.js'
import { varietyBag, varietyOptions } from './variety.js'

const write = (target: Target) =>
  writeDocument(pipeline(varietyBag).spec().model, target, varietyOptions)

const codes = (diagnostics: readonly { code: string; at: object }[]) =>
  diagnostics.map(({ code, at }) => [code, at])

describe.each(TARGETS)('OpenAPI %s', (target) => {
  test('the variety document is valid and matches its snapshot', async () => {
    const written = write(target)

    expectValidOpenAPI(written.document, target)
    await expect(documentSnapshot(written)).toMatchFileSnapshot(
      `__snapshots__/variety.${target}.yaml`
    )
  })

  test('two builds give byte-equal documents', () => {
    const [first, second] = [write(target), write(target)]

    for (const format of ['yaml', 'json'] as const)
      expect(serialize(second.document, format)).toBe(
        serialize(first.document, format)
      )
  })

  test('approximations are reported with their capability and pointer', () => {
    const downgrades = write(target)
      .diagnostics.filter(({ code }) => code === 'writer/downgrade')
      .map(({ at, data }) => [data, at.pointer])
    const owner = '/components/schemas/Owner/properties'
    const openapi = CAPABILITIES[target].openapi

    expect(downgrades).toEqual(
      CAPABILITIES[target].tuple === 'prefix-items'
        ? []
        : [
            [{ capability: 'tuple', target: openapi }, `${owner}/position`],
            [
              { capability: 'propertyNames', target: openapi },
              `${owner}/labels`,
            ],
            [
              { capability: 'schemaExamples', target: openapi },
              `${owner}/note`,
            ],
            [{ capability: 'annotations', target: openapi }, `${owner}/note`],
          ]
    )
  })
})

describe('document', () => {
  const { document, diagnostics } = write(TARGETS[0])
  const paths = document.paths as Record<string, any>

  test('declared tags come first, used tags follow sorted and are reported', () => {
    expect(document.tags).toEqual([
      { name: 'owners', description: 'Pet owners' },
      { name: 'pets' },
    ])
    expect(codes(diagnostics)).toContainEqual(['writer/tag-undeclared', {}])
  })

  test('a discriminator is inferred for components and reported for inline members', () => {
    const owner = (document.components as any).schemas.Owner.properties

    expect(owner.pet.anyOf[0].discriminator).toEqual({
      propertyName: 'type',
      mapping: {
        cat: '#/components/schemas/Cat',
        dog: '#/components/schemas/Dog',
      },
    })
    expect(owner.shape.discriminator).toBeUndefined()
    expect(codes(diagnostics)).toContainEqual([
      'writer/discriminator-not-emitted',
      { pointer: '/components/schemas/Owner/properties/shape' },
    ])
  })

  test('an enum component carries its member names', () => {
    expect((document.components as any).schemas.Status).toMatchObject({
      enum: ['active', 'archived'],
      'x-enum-varnames': ['Active', 'Archived'],
    })
  })

  test('operations carry meta, response headers, json query parameters and x- extensions only', () => {
    const get = paths['/owners/{ownerId}'].get

    expect(get).toMatchObject({
      tags: ['owners', 'pets'],
      summary: 'Get an owner',
      deprecated: true,
      security: [{ bearer: [] }],
      servers: [{ url: 'https://legacy.example.com' }],
      'x-audience': 'partners',
    })
    expect(get).not.toHaveProperty('internal')
    expect(get.responses['200'].headers).toEqual({
      'x-rate-limit': { required: true, schema: { type: 'integer' } },
      'x-trace': { schema: { type: 'string' } },
    })
    expect(paths['/owners'].post.parameters).toEqual([
      {
        name: 'filter',
        in: 'query',
        required: false,
        content: {
          'application/json': {
            schema: expect.objectContaining({ type: 'object' }),
          },
        },
      },
    ])
    expect(paths['/owners'].post.requestBody.required).toBe(true)
  })
})

const responseOf = (body: z.ZodType, target: Target = TARGETS[0]) => {
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/union').responses({ 200: json(body) }))
    .build()
  const { document, diagnostics } = writeDocument(
    pipeline(bag).spec().model,
    target,
    varietyOptions
  )
  const paths = document.paths as Record<string, any>
  return {
    document,
    schema:
      paths['/union'].get.responses['200'].content['application/json'].schema,
    diagnostics,
    codes: diagnostics.map(({ code }) => code),
  }
}

const member = (id: string, fields: z.ZodRawShape) =>
  z.object(fields).meta({ id })

const A = member('A', { kind: z.literal('a') })
const B = member('B', { kind: z.literal('b') })
const refs = [
  { $ref: '#/components/schemas/A' },
  { $ref: '#/components/schemas/B' },
]

describe('discriminator inference', () => {
  const unionOf = (...members: z.ZodObject[]) =>
    responseOf(z.union(members as any))

  test('needs exactly one discriminating property', () => {
    const { schema, codes } = unionOf(
      member('A', { kind: z.literal('a'), type: z.literal('x') }),
      member('B', { kind: z.literal('b'), type: z.literal('y') })
    )

    expect(schema).toEqual({ anyOf: refs })
    expect(codes).not.toContain('writer/discriminator-not-emitted')
  })

  test.each([
    ['a value shared by two members', z.literal('a'), z.literal('a')],
    ['an optional property', z.literal('a'), z.literal('b').optional()],
    ['a number literal', z.literal(1), z.literal(2)],
  ])('ignores %s', (_, first, second) => {
    const { schema } = unionOf(
      member('A', { kind: first }),
      member('B', { kind: second })
    )

    expect(schema).not.toHaveProperty('discriminator')
  })
})

describe.each(TARGETS)('OpenAPI %s schemas', (target) => {
  const nullKeyword = CAPABILITIES[target].nullable === 'nullable-keyword'
  const nullSchema = nullKeyword
    ? { type: 'string', enum: [null], nullable: true }
    : { type: 'null' }
  const discriminator = {
    propertyName: 'kind',
    mapping: {
      a: '#/components/schemas/A',
      b: '#/components/schemas/B',
    },
  }

  test.each([
    [
      'a nullable discriminated union',
      z.discriminatedUnion('kind', [A, B]).nullable(),
      'oneOf',
    ],
    ['a union with a null member', z.union([A, B, z.null()]), 'anyOf'],
  ])('%s keeps null outside the discriminated union', (_, body, keyword) => {
    expect(responseOf(body, target).schema).toEqual({
      anyOf: [{ [keyword]: refs, discriminator }, nullSchema],
    })
  })

  test('a nullable reference to a component that accepts null is the reference', () => {
    const Maybe = z.string().nullable().meta({ id: 'Maybe' })

    expect(responseOf(Maybe.nullable(), target).schema).toEqual({
      $ref: '#/components/schemas/Maybe',
    })
  })

  test('a union of literals is one enum without repeated values, with their names', () => {
    const named = (values: [string, ...string[]], names: string[]) =>
      z.enum(values).meta({ 'x-enum-varnames': names })
    const { schema } = responseOf(
      z.union([named(['a', 'b'], ['A', 'B']), named(['b', 'c'], ['B', 'C'])]),
      target
    )

    expect(schema).toMatchObject({
      enum: ['a', 'b', 'c'],
      'x-enum-varnames': ['A', 'B', 'C'],
    })
  })

  test('an empty tuple is an empty array', () => {
    const { document, schema } = responseOf(z.tuple([]), target)

    expectValidOpenAPI(document, target)
    expect(schema).toEqual({
      type: 'array',
      items: CAPABILITIES[target].tuple === 'prefix-items' ? false : {},
      minItems: 0,
      maxItems: 0,
    })
  })

  test('a nullable named enum names its null', () => {
    const { schema } = responseOf(
      z
        .enum(['a', 'b'])
        .meta({ 'x-enum-varnames': ['A', 'B'] })
        .nullable(),
      target
    )

    expect(schema).toMatchObject({
      enum: ['a', 'b', null],
      'x-enum-varnames': ['A', 'B', 'Null'],
    })
  })
})

const expectInstances = (
  body: z.ZodType,
  target: Target,
  { accepts, rejects }: { accepts: unknown[]; rejects: unknown[] }
) => {
  const { document, schema } = responseOf(body, target)
  const validate = instanceValidator(document, target, schema)
  const verdicts = (instances: unknown[]) =>
    instances.map((instance) => [instance, validate(instance)])

  expect(verdicts([...accepts, ...rejects]), JSON.stringify(schema)).toEqual([
    ...accepts.map((instance) => [instance, true]),
    ...rejects.map((instance) => [instance, false]),
  ])
}

// The source of an exclusive union, read as `oneOf`: a body schema of
// `z.any()` that zod itself does not check.
const exclusive = (...oneOf: object[]) => z.any().meta({ oneOf })

describe.each(TARGETS)('OpenAPI %s nullable compositions', (target) => {
  const nullableString = z.string().nullable()
  const strings = { accepts: [null, 'a'], rejects: [1] }
  // both members accept null, so null matches two and is rejected
  const either = exclusive(
    { type: ['string', 'null'] },
    { type: ['number', 'null'] }
  )

  test.each([
    [
      'an intersection that accepts null',
      z.intersection(nullableString, nullableString).nullable(),
      strings,
    ],
    [
      'a reference to an intersection that accepts null',
      z
        .intersection(nullableString, nullableString)
        .meta({ id: 'Both' })
        .nullable(),
      strings,
    ],
    [
      'a reference to unknown',
      z.unknown().meta({ id: 'Anything' }).nullable(),
      { accepts: [null, 'a', 1], rejects: [] },
    ],
    [
      'an exclusive union whose members accept null',
      either.nullable(),
      { accepts: [null, 'a', 1], rejects: [true] },
    ],
    [
      'a reference to an exclusive union whose members accept null',
      either.meta({ id: 'Either' }).nullable(),
      { accepts: [null, 'a', 1], rejects: [true] },
    ],
  ])('%s, made nullable, accepts null', (_, body, instances) => {
    expectInstances(body, target, instances)
  })

  test('an exclusive union whose members accept null rejects null', () => {
    expectInstances(either, target, { accepts: ['a', 1], rejects: [null] })
  })
})

describe.each(TARGETS)('OpenAPI %s exclusive unions', (target) => {
  test.each([
    [
      'overlapping literals',
      exclusive({ enum: ['a', 'b'] }, { enum: ['b', 'c'] }),
      { accepts: ['a', 'c'], rejects: ['b', 'd'] },
    ],
    [
      'an unknown member',
      exclusive({}, { type: 'string' }),
      { accepts: [1, null], rejects: ['a'] },
    ],
    [
      'a null member beside a member that accepts null',
      exclusive({ type: ['string', 'null'] }, { type: 'null' }),
      { accepts: ['a'], rejects: [null, 1] },
    ],
  ])('with %s match exactly one member', (_, body, instances) => {
    expectInstances(body, target, instances)
  })

  test('disjoint literals are one enum', () => {
    const body = exclusive({ enum: ['a'] }, { enum: ['b', 'c'] })

    expect(responseOf(body, target).schema).toMatchObject({
      enum: ['a', 'b', 'c'],
    })
    expectInstances(body, target, { accepts: ['a', 'b', 'c'], rejects: ['d'] })
  })
})

describe('binary strings in OpenAPI 3.0', () => {
  const target = TARGETS.find(
    (candidate) => CAPABILITIES[candidate].binary === 'format'
  ) as Target
  const binaryDowngrades = (diagnostics: readonly any[]) =>
    diagnostics.filter(
      ({ code, data }) =>
        code === 'writer/downgrade' && data.capability === 'binary'
    )

  test.each([
    [
      'a JSON string with a media type',
      z.string().meta({ contentMediaType: 'application/json' }),
      { type: 'string' },
    ],
    [
      'a base64url string',
      z.base64url(),
      expect.objectContaining({ type: 'string', format: 'base64url' }),
    ],
    [
      'a base64 string with a media type',
      z
        .string()
        .meta({ contentEncoding: 'base64', contentMediaType: 'image/png' }),
      { type: 'string', format: 'byte' },
    ],
  ])('%s keeps its format and reports what it drops', (_, body, expected) => {
    const { schema, diagnostics } = responseOf(
      z.object({ value: body }),
      target
    )

    expect(schema.properties.value).toEqual(expected)
    expect(binaryDowngrades(diagnostics)).toHaveLength(1)
  })

  test('a base64 string is a byte string', () => {
    const { schema, diagnostics } = responseOf(
      z.object({ value: z.base64() }),
      target
    )

    expect(schema.properties.value).toMatchObject({ format: 'byte' })
    expect(binaryDowngrades(diagnostics)).toEqual([])
  })

  const binary = { type: 'string', format: 'binary' }
  const upload = (nameBody: boolean) => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.post('/upload')
          .multipart({ files: { file: { required: true } } })
          .validate(z.object({ body: z.object({ title: z.string() }) }))
          .responses({ 204: empty() })
      )
      .build()
    const nameAnonymous = (context: AnonymousContext) =>
      context.kind === 'slot' && context.slot === 'body'
        ? 'UploadBody'
        : undefined
    const model = pipeline(
      bag,
      undefined,
      nameBody ? { nameAnonymous } : {}
    ).spec().model
    const { document, diagnostics } = writeDocument(
      model,
      target,
      varietyOptions
    )
    return {
      body: (document.paths as any)['/upload'].post.requestBody.content[
        'multipart/form-data'
      ].schema,
      schemas: (document.components as any)?.schemas,
      diagnostics,
    }
  }

  test('a named multipart body keeps its files binary', () => {
    const inline = upload(false)
    const named = upload(true)

    expect(named.body).toEqual({ $ref: '#/components/schemas/UploadBody' })
    expect(named.schemas.UploadBody).toEqual(inline.body)
    expect(named.schemas.UploadBody.properties.file).toEqual(binary)
    expect(binaryDowngrades(named.diagnostics)).toEqual([])
  })

  test('a component used by JSON and a multipart body is inlined into the multipart body', () => {
    const Doc = z
      .object({ image: z.string().meta({ contentMediaType: 'image/png' }) })
      .meta({ id: 'Doc' })
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.post('/upload')
          .multipart({ files: { file: { required: true } } })
          .validate(z.object({ body: z.object({ doc: Doc }) }))
          .responses({ 200: json(Doc) })
      )
      .build()
    const { document } = writeDocument(
      pipeline(bag).spec().model,
      target,
      varietyOptions
    )
    const post = (document.paths as any)['/upload'].post

    expect(
      post.requestBody.content['multipart/form-data'].schema.properties.doc
    ).toEqual({
      type: 'object',
      properties: { image: binary },
      required: ['image'],
    })
    expect(post.responses['200'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/Doc',
    })
    expect((document.components as any).schemas.Doc.properties.image).toEqual({
      type: 'string',
    })
  })
})
