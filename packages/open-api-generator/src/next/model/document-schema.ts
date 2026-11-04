import type { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import type { ComponentName, DefKey, Shape } from './types.js'
import { refsOf } from './shape.js'
import { MODEL_VERSION } from './version-history.js'

/** A pipeline type as JSON data: brands become strings, nothing is readonly. */
export type Unbranded<T> = T extends ComponentName | DefKey
  ? string
  : T extends readonly (infer E)[]
  ? Unbranded<E>[]
  : T extends object
  ? {
      -readonly [K in keyof T as K extends ComponentName | DefKey
        ? string
        : K]: Unbranded<T[K]>
    }
  : T

type ShapeDocument = Unbranded<Shape<string>>

// Ids and descriptions go to this private registry, never to `z.globalRegistry`,
// so loading the generator does not change the user's zod registry.
const registry = z.registry<{ id: string; description: string }>()

const named = <T extends z.ZodType>(
  id: string,
  description: string,
  schema: T
) => {
  registry.add(schema, { id, description })
  return schema
}

const docsSchema = named(
  'Docs',
  'Documentation of a shape. None of it changes which values the shape accepts.',
  z.strictObject({
    title: z.string().optional(),
    description: z.string().optional(),
    examples: z.array(z.unknown()).optional(),
    default: z.unknown().optional(),
    deprecated: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    writeOnly: z.boolean().optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
)

const literalSchema = z.union([z.string(), z.number(), z.boolean()])

const leaf = <K extends string, T extends z.ZodRawShape>(kind: K, shape: T) =>
  z.strictObject({
    kind: z.literal(kind),
    ...shape,
    docs: docsSchema.optional(),
  })

// `shapeSchema` carries an annotation so the declaration emit does not inline
// the recursive union; `_ShapeMatchesModel` proves the annotation is exact.
const fieldSchema = named(
  'Field',
  'An object property. Optionality lives here, never on the shape.',
  z.strictObject({
    name: z.string(),
    required: z.boolean(),
    get shape() {
      return shapeSchema
    },
  })
)

const arrayShapeSchema = z.strictObject({
  kind: z.literal('array'),
  get items() {
    return shapeSchema
  },
  minItems: z.number().optional(),
  maxItems: z.number().optional(),
  uniqueItems: z.boolean().optional(),
  docs: docsSchema.optional(),
})

const tupleShapeSchema = z.strictObject({
  kind: z.literal('tuple'),
  get prefix() {
    return z.array(shapeSchema)
  },
  get rest() {
    return shapeSchema.optional()
  },
  minItems: z.number().optional(),
  docs: docsSchema.optional(),
})

const objectShapeSchema = z.strictObject({
  kind: z.literal('object'),
  fields: z.array(fieldSchema),
  get additional() {
    return z.union([shapeSchema, z.literal(false)]).optional()
  },
  get propertyNames() {
    return shapeSchema.optional()
  },
  minProperties: z.number().optional(),
  maxProperties: z.number().optional(),
  docs: docsSchema.optional(),
})

const unionShapeSchema = z.strictObject({
  kind: z.literal('union'),
  get members() {
    return z.array(shapeSchema)
  },
  exclusive: z.boolean(),
  docs: docsSchema.optional(),
})

const intersectionShapeSchema = z.strictObject({
  kind: z.literal('intersection'),
  get members() {
    return z.array(shapeSchema)
  },
  docs: docsSchema.optional(),
})

const shapeUnion = z.discriminatedUnion('kind', [
  leaf('unknown', {}),
  leaf('never', {}),
  leaf('null', {}),
  leaf('boolean', {}),
  leaf('string', {
    format: z.string().optional(),
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    contentEncoding: z.string().optional(),
    contentMediaType: z.string().optional(),
  }),
  leaf('number', {
    integer: z.boolean(),
    format: z.string().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    exclusiveMinimum: z.number().optional(),
    exclusiveMaximum: z.number().optional(),
    multipleOf: z.number().optional(),
  }),
  leaf('enum', {
    values: z.array(literalSchema),
    names: z.array(z.string()).optional(),
  }),
  arrayShapeSchema,
  tupleShapeSchema,
  objectShapeSchema,
  unionShapeSchema,
  intersectionShapeSchema,
  leaf('ref', { target: z.string() }),
])

const shapeSchema: z.ZodType<ShapeDocument> = named(
  'Shape',
  'A JSON wire value. `null` is a union member; a literal is a one-member enum; `ref.target` names a key of `types`.',
  shapeUnion
)

type _ShapeMatchesModel = AssertTrue<
  IsExact<z.infer<typeof shapeUnion>, ShapeDocument>
>

const directionSchema = z.enum(['input', 'output'])

const typeDefSchema = named(
  'TypeDef',
  'A type other shapes refer to. `anonymous` is recursion without an author id.',
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('named'),
      id: z.string(),
      direction: directionSchema,
      shape: shapeSchema,
    }),
    z.strictObject({
      kind: z.literal('anonymous'),
      direction: directionSchema,
      shape: shapeSchema,
    }),
  ])
)

const exampleSchema = z.strictObject({
  summary: z.string().optional(),
  description: z.string().optional(),
  value: z.unknown(),
})

const mediaTypeSchema = named(
  'MediaType',
  'A body in one content type.',
  z.strictObject({
    shape: shapeSchema,
    examples: z.record(z.string(), exampleSchema).optional(),
    encoding: z
      .record(z.string(), z.strictObject({ contentType: z.string() }))
      .optional(),
  })
)

const responseSchema = named(
  'Response',
  'One status of an operation. `content` is empty for a response without a body.',
  z.strictObject({
    description: z.string(),
    headers: z.array(
      z.strictObject({
        name: z.string(),
        required: z.boolean(),
        shape: shapeSchema,
      })
    ),
    content: z.record(z.string(), mediaTypeSchema),
  })
)

const parameterSchema = named(
  'Parameter',
  'A path, query or header parameter. `encoding: json` means the value travels as a JSON string.',
  z.strictObject({
    name: z.string(),
    in: z.enum(['path', 'query', 'header']),
    required: z.boolean(),
    shape: shapeSchema,
    encoding: z.enum(['plain', 'json']),
  })
)

const securitySchema = z.array(
  z.array(z.strictObject({ scheme: z.string(), scopes: z.array(z.string()) }))
)

const linkSchema = z.strictObject({
  url: z.string(),
  description: z.string().optional(),
})

const operationSchema = named(
  'Operation',
  'One route in one version. `key` is built from the normalized path, for example `GET /users/{} @2024-01-01`.',
  z.strictObject({
    key: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string(),
    version: z.string(),
    operationId: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()),
    deprecated: z.boolean(),
    externalDocs: linkSchema.optional(),
    servers: z.array(linkSchema).optional(),
    parameters: z.array(parameterSchema),
    requestBody: z
      .strictObject({
        required: z.boolean(),
        content: z.record(z.string(), mediaTypeSchema),
      })
      .optional(),
    responses: z.record(
      z.string(),
      z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('inline'), response: responseSchema }),
        z.strictObject({ kind: z.literal('shared'), id: z.string() }),
      ])
    ),
    security: securitySchema,
    extensions: z.record(z.string(), z.unknown()),
  })
)

const securitySchemeSchema = named(
  'SecurityScheme',
  'A security scheme, referenced by name from `Operation.security`.',
  z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('http'),
      scheme: z.string(),
      bearerFormat: z.string().optional(),
      description: z.string().optional(),
    }),
    z.strictObject({
      type: z.literal('apiKey'),
      in: z.enum(['header', 'query', 'cookie']),
      name: z.string(),
      description: z.string().optional(),
    }),
    z.strictObject({
      type: z.literal('oauth2'),
      flows: z.record(z.string(), z.unknown()),
      description: z.string().optional(),
    }),
    z.strictObject({
      type: z.literal('openIdConnect'),
      openIdConnectUrl: z.string(),
      description: z.string().optional(),
    }),
  ])
)

const documentSchema = z.strictObject({
  modelVersion: z.literal(MODEL_VERSION),
  versioning: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('none') }),
    z.strictObject({
      kind: z.enum(['date', 'semver']),
      history: z.array(z.string()),
    }),
  ]),
  types: z.record(z.string(), typeDefSchema),
  responses: z.record(z.string(), responseSchema),
  securitySchemes: z.record(z.string(), securitySchemeSchema),
  operations: z.array(operationSchema),
})

export type ApiModelDocument = z.infer<typeof documentSchema>

type ResponseDocument = ApiModelDocument['responses'][string]

const responseShapes = (response: ResponseDocument) => [
  ...response.headers.map((header) => header.shape),
  ...Object.values(response.content).map((media) => media.shape),
]

const shapesOf = (document: ApiModelDocument): ShapeDocument[] => [
  ...Object.values(document.types).map((type) => type.shape),
  ...Object.values(document.responses).flatMap(responseShapes),
  ...document.operations.flatMap((operation) => [
    ...operation.parameters.map((parameter) => parameter.shape),
    ...Object.values(operation.requestBody?.content ?? {}).map(
      (media) => media.shape
    ),
    ...Object.values(operation.responses).flatMap((slot) =>
      slot.kind === 'inline' ? responseShapes(slot.response) : []
    ),
  ]),
]

const has = (record: object, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key)

/** Names the document refers to that it does not define; JSON Schema cannot check these. */
const danglingNames = (document: ApiModelDocument): string[] => {
  const { types, responses, securitySchemes, operations } = document
  const refTargets = shapesOf(document)
    .flatMap(refsOf)
    .map((ref) => ref.target)
  const sharedResponses = operations
    .flatMap((operation) => Object.values(operation.responses))
    .flatMap((slot) => (slot.kind === 'shared' ? [slot.id] : []))
  const schemes = operations
    .flatMap((operation) => operation.security.flat())
    .map((requirement) => requirement.scheme)

  return [
    ...refTargets
      .filter((target) => !has(types, target))
      .map((target) => `ref target '${target}' is not a key of types`),
    ...sharedResponses
      .filter((id) => !has(responses, id))
      .map((id) => `shared response '${id}' is not a key of responses`),
    ...schemes
      .filter((scheme) => !has(securitySchemes, scheme))
      .map(
        (scheme) =>
          `security scheme '${scheme}' is not a key of securitySchemes`
      ),
  ]
}

export const apiModelDocumentSchema: z.ZodType<ApiModelDocument> =
  documentSchema.superRefine((document, context) => {
    for (const message of new Set(danglingNames(document)))
      context.addIssue({ code: 'custom', message })
  })

const { $schema, ...documentJsonSchema } = z.toJSONSchema(documentSchema, {
  target: 'draft-2020-12',
  metadata: registry,
})

export const apiModelJsonSchema: z.core.JSONSchema.BaseSchema = {
  $schema,
  title: 'ApiModelDocument',
  description:
    'The API model of one spec: its operations and the types, shared responses and security schemes they reach.',
  ...documentJsonSchema,
}

export const parseApiModel = (json: unknown): ApiModelDocument =>
  apiModelDocumentSchema.parse(json)
