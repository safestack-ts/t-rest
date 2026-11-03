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

/** Every Schema Object position outside other Schema Objects, by JSON pointer. */
const schemaObjects = (document: unknown): [string, unknown][] => {
  const found: [string, unknown][] = []
  const visit = (node: unknown, pointer: string) => {
    if (typeof node !== 'object' || node === null) return
    for (const [key, value] of Object.entries(node)) {
      const at = `${pointer}/${escape(key)}`
      if (key.startsWith('x-') || key === 'example' || key === 'examples')
        continue
      if (key === 'schema' || key === 'itemSchema') found.push([at, value])
      else if (pointer === '/components' && key === 'schemas')
        for (const [name, schema] of Object.entries(value ?? {}))
          found.push([`${at}/${escape(name)}`, schema])
      else visit(value, at)
    }
  }
  visit(document, '')
  return found
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
