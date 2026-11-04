import Ajv2020 from 'ajv/dist/2020'
import AjvDraft04 from 'ajv-draft-04'
import type { ErrorObject, ValidateFunction } from 'ajv'
import openapi30 from './meta-schemas/openapi-3.0.schema.json'
import openapi31 from './meta-schemas/openapi-3.1.schema.json'
import openapi32 from './meta-schemas/openapi-3.2.schema.json'

export type OpenAPITarget = '3.0' | '3.1' | '3.2'

// See meta-schemas/README.md: Ajv cannot resolve this `$dynamicRef`, and without
// an extending dialect it points at `#/$defs/schema`.
const withStaticSchemaRef = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(withStaticSchemaRef)
  if (typeof node !== 'object' || node === null) return node
  if ('$dynamicRef' in node && node.$dynamicRef === '#meta')
    return { $ref: '#/$defs/schema' }
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      withStaticSchemaRef(value),
    ])
  )
}

const SCHEMA_OBJECT = 'urn:t-rest:openapi-3.1-schema-object'

// The root `$dynamicAnchor` makes every `$dynamicRef: "#meta"` of the 2020-12
// meta-schema recurse into this schema, so `nullable` is rejected at any depth.
// The 3.0 boolean `exclusiveMinimum`/`exclusiveMaximum` already fail 2020-12.
const schemaObjectMetaSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: SCHEMA_OBJECT,
  $dynamicAnchor: 'meta',
  $ref: 'https://json-schema.org/draft/2020-12/schema',
  properties: { nullable: false },
}

const escape = (segment: string) =>
  segment.replace(/~/g, '~0').replace(/\//g, '~1')

const at = (pointer: string, key: string | number) =>
  `${pointer}/${escape(String(key))}`

const isObject = (node: unknown): node is Record<string, unknown> =>
  typeof node === 'object' && node !== null && !Array.isArray(node)

type Found = { schemas: [string, unknown][] }

/** Collects what `node` holds, given the OpenAPI object type of its position. */
type Shape = (node: unknown, pointer: string, found: Found) => void

/** An object whose listed fields have the given shapes; other fields are ignored. */
const fields =
  (shapes: Record<string, Shape>): Shape =>
  (node, pointer, found) => {
    if (!isObject(node)) return
    for (const [key, shape] of Object.entries(shapes))
      if (node[key] !== undefined) shape(node[key], at(pointer, key), found)
  }

/** A map whose keys are names, such as component, header or media type names. */
const mapOf =
  (shape: Shape): Shape =>
  (node, pointer, found) => {
    if (!isObject(node)) return
    for (const [key, value] of Object.entries(node))
      shape(value, at(pointer, key), found)
  }

/** A map with patterned keys next to `x-` Specification Extensions. */
const patterned =
  (shape: Shape): Shape =>
  (node, pointer, found) => {
    if (!isObject(node)) return
    for (const [key, value] of Object.entries(node))
      if (!key.startsWith('x-')) shape(value, at(pointer, key), found)
  }

const arrayOf =
  (shape: Shape): Shape =>
  (node, pointer, found) => {
    if (Array.isArray(node))
      node.forEach((item, index) => shape(item, at(pointer, index), found))
  }

const lazy =
  (shape: () => Shape): Shape =>
  (...args) =>
    shape()(...args)

const schema: Shape = (node, pointer, found) => {
  found.schemas.push([pointer, node])
}

const encoding: Shape = fields({
  headers: mapOf(lazy(() => header)),
  encoding: mapOf(lazy(() => encoding)),
  prefixEncoding: arrayOf(lazy(() => encoding)),
  itemEncoding: lazy(() => encoding),
})

const mediaType = fields({
  schema,
  itemSchema: schema,
  encoding: mapOf(encoding),
  prefixEncoding: arrayOf(encoding),
  itemEncoding: encoding,
})

const content = mapOf(mediaType)

const parameter = fields({ schema, content })

const header = parameter

const requestBody = fields({ content })

const response = fields({ headers: mapOf(header), content })

const operation = fields({
  parameters: arrayOf(parameter),
  requestBody,
  responses: patterned(response),
  callbacks: mapOf(lazy(() => callback)),
})

const methods = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
  'query',
]

const pathItem = fields({
  parameters: arrayOf(parameter),
  additionalOperations: mapOf(operation),
  ...Object.fromEntries(methods.map((method) => [method, operation])),
})

const callback = patterned(pathItem)

const openAPIDocument = fields({
  paths: patterned(pathItem),
  webhooks: mapOf(pathItem),
  components: fields({
    schemas: mapOf(schema),
    responses: mapOf(response),
    parameters: mapOf(parameter),
    requestBodies: mapOf(requestBody),
    headers: mapOf(header),
    callbacks: mapOf(callback),
    pathItems: mapOf(pathItem),
    mediaTypes: mapOf(mediaType),
  }),
})

/** Every Schema Object position outside other Schema Objects, by JSON pointer. */
const schemaObjects = (document: unknown): [string, unknown][] => {
  const found: Found = { schemas: [] }
  openAPIDocument(document, '', found)
  return found.schemas
}

const resolves = (document: unknown, ref: string) =>
  decodeURIComponent(ref.slice(1))
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>(
      (node, segment) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      document
    ) !== undefined

const danglingRefs = (document: unknown): string[] => {
  const errors: string[] = []
  const visit = (node: unknown, pointer: string) => {
    if (typeof node !== 'object' || node === null) return
    for (const [key, value] of Object.entries(node)) {
      const at = `${pointer}/${escape(key)}`
      if (
        key === '$ref' &&
        typeof value === 'string' &&
        value.startsWith('#') &&
        !resolves(document, value)
      )
        errors.push(`  ${at} ${value} does not resolve`)
      else visit(value, at)
    }
  }
  visit(document, '')
  return errors
}

const options = { strict: false, allErrors: true, validateFormats: false }

const errorLines = (errors: ErrorObject[] | null | undefined, at = '') =>
  (errors ?? []).map(
    ({ instancePath, message, params }) =>
      `  ${at + instancePath || '/'} ${message} ${JSON.stringify(params)}`
  )

type Check = (document: unknown) => string[]

const draft04Check = (metaSchema: object): Check => {
  const validate = new AjvDraft04(options).compile(metaSchema)
  return (document) => (validate(document) ? [] : errorLines(validate.errors))
}

// The 3.1 and 3.2 meta-schemas only check that a Schema Object is an object or
// a boolean, so each one is also checked on its own as JSON Schema 2020-12.
const draft2020Check = (metaSchema: object): Check => {
  const ajv = new Ajv2020(options).addSchema(schemaObjectMetaSchema)
  const validateDocument = ajv.compile(
    withStaticSchemaRef(metaSchema) as object
  )
  const validateSchema = ajv.getSchema(SCHEMA_OBJECT) as ValidateFunction
  return (document) => [
    ...(validateDocument(document) ? [] : errorLines(validateDocument.errors)),
    ...schemaObjects(document).flatMap(([pointer, schema]) =>
      validateSchema(schema) ? [] : errorLines(validateSchema.errors, pointer)
    ),
  ]
}

const createCheck: Record<OpenAPITarget, () => Check> = {
  '3.0': () => draft04Check(openapi30),
  '3.1': () => draft2020Check(openapi31),
  '3.2': () => draft2020Check(openapi32),
}

const checks = new Map<OpenAPITarget, Check>()

const checkFor = (target: OpenAPITarget) => {
  const check = checks.get(target) ?? createCheck[target]()
  checks.set(target, check)
  return check
}

/**
 * Throws when `document` is not a valid OpenAPI `target` document, listing the
 * meta-schema's errors, invalid Schema Objects and local `$ref`s that do not
 * resolve.
 */
export const expectValidOpenAPI = (
  document: unknown,
  target: OpenAPITarget
): void => {
  const errors = [...checkFor(target)(document), ...danglingRefs(document)]
  if (errors.length === 0) return

  throw new Error(
    [`Not a valid OpenAPI ${target} document:`, ...errors].join('\n')
  )
}
