// The only file that names OpenAPI versions. Every difference between targets
// is a column here; the writer reads the columns and never the target.

export interface Capabilities {
  /** The `openapi` field of the document. */
  readonly openapi: string
  readonly nullable: 'nullable-keyword' | 'null-type'
  readonly literal: 'one-value-enum' | 'const'
  readonly tuple: 'items-any-of' | 'prefix-items'
  readonly exclusiveBounds: 'boolean' | 'number'
  readonly schemaExamples: 'example' | 'examples'
  readonly refSiblings: 'all-of-wrapper' | 'siblings'
  readonly binary: 'format' | 'content-keywords'
  readonly propertyNames: 'dropped' | 'kept'
  readonly annotations: 'extensions-only' | 'any-keyword'
}

export type Capability = Exclude<keyof Capabilities, 'openapi'>

export const CAPABILITIES = {
  '3.0': {
    openapi: '3.0.3',
    nullable: 'nullable-keyword',
    literal: 'one-value-enum',
    tuple: 'items-any-of',
    exclusiveBounds: 'boolean',
    schemaExamples: 'example',
    refSiblings: 'all-of-wrapper',
    binary: 'format',
    propertyNames: 'dropped',
    annotations: 'extensions-only',
  },
  '3.1': {
    openapi: '3.1.1',
    nullable: 'null-type',
    literal: 'const',
    tuple: 'prefix-items',
    exclusiveBounds: 'number',
    schemaExamples: 'examples',
    refSiblings: 'siblings',
    binary: 'content-keywords',
    propertyNames: 'kept',
    annotations: 'any-keyword',
  },
  '3.2': {
    openapi: '3.2.0',
    nullable: 'null-type',
    literal: 'const',
    tuple: 'prefix-items',
    exclusiveBounds: 'number',
    schemaExamples: 'examples',
    refSiblings: 'siblings',
    binary: 'content-keywords',
    propertyNames: 'kept',
    annotations: 'any-keyword',
  },
} as const satisfies Record<string, Capabilities>

export type Target = keyof typeof CAPABILITIES

export const TARGETS = Object.keys(CAPABILITIES) as Target[]

/** Markdown for `targets.md`: what each column decides, and what its values emit. */
export const CAPABILITY_DOCS: { readonly [K in keyof Capabilities]: string } = {
  openapi: 'The `openapi` version the document declares.',
  nullable:
    '`nullable-keyword`: a nullable typed schema gets `nullable: true` (an enum also lists `null`), anything else becomes `oneOf: [schema, { type: string, enum: [null], nullable: true }]`. `null-type`: a typed schema gets `type: [type, "null"]`, anything else becomes `anyOf: [schema, { type: "null" }]`. In every target, a schema that already accepts null stays as it is, a named enum names the added `null` `Null`, and a discriminated union keeps `null` outside it: `anyOf: [{ oneOf: [...], discriminator }, null schema]`.',
  literal:
    '`one-value-enum`: a single literal is `enum: [value]`. `const`: it is `const: value`.',
  tuple:
    '`items-any-of`: a tuple is an array whose `items` match any element schema, with `minItems` and `maxItems`; element positions are lost when the elements differ (`writer/downgrade`). `prefix-items`: `prefixItems` with `items` for the rest or `items: false`.',
  exclusiveBounds:
    '`boolean`: `exclusiveMinimum: true` next to `minimum` (the stricter bound wins when both are set). `number`: `exclusiveMinimum: value`.',
  schemaExamples:
    '`example`: a Schema Object keeps its first example as `example`; more examples are dropped (`writer/downgrade`). `examples`: the list is kept. Media Type and parameter `examples` maps are the same in every target.',
  refSiblings:
    '`all-of-wrapper`: a reference with docs becomes `allOf: [{ $ref }]` with the docs next to it, since `$ref` siblings are ignored. `siblings`: the docs sit next to `$ref`.',
  binary:
    '`format`: a base64 `contentEncoding` is `format: byte`. In a body that is not JSON (a binary body or a multipart file part), a string with `contentMediaType` and no encoding is `format: binary`, and the Media Type Object or the multipart `encoding` documents its media type. Any other `contentMediaType` or `contentEncoding` is dropped and the string keeps its `format` (`writer/downgrade`). `content-keywords`: `contentMediaType` and `contentEncoding` are kept.',
  propertyNames:
    '`dropped`: a constrained `propertyNames` is left out (`writer/downgrade`). `kept`: it is emitted. Plain string keys need no `propertyNames` in any target.',
  annotations:
    '`extensions-only`: a Schema Object keeps only `x-` keywords among unknown annotations; others are dropped (`writer/downgrade`). `any-keyword`: every annotation keyword is kept.',
}
