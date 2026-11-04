import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import type {
  ApiModel,
  ComponentName,
  HTTPMethod,
  MediaType,
  Operation,
  Parameter,
  Response,
  ResponseSlot,
  Security,
  Server,
  Shape,
} from '../model/types.js'
import { refsOf } from '../model/shape.js'
import { pointerTo } from '../reader/json-schema.js'
import { allocate } from '../naming/assign-names.js'
import { Capabilities, CAPABILITIES, Target } from './capabilities.js'
import { compact, holdsRawBytes, SchemaObject, schemaWriter } from './schema.js'

export interface DocumentInfo {
  readonly title: string
  readonly version: string
  readonly description?: string
  readonly contact?: {
    readonly name?: string
    readonly url?: string
    readonly email?: string
  }
  readonly license?: { readonly name: string; readonly url?: string }
}

export interface TagObject {
  readonly name: string
  readonly description?: string
  readonly externalDocs?: {
    readonly url: string
    readonly description?: string
  }
}

/** What the document says about itself; the model has no place for it. */
export interface DocumentOptions {
  readonly info: DocumentInfo
  readonly servers?: readonly Server[]
  /** Declared tags, in this order; tags only operations use are appended, sorted. */
  readonly tags?: readonly TagObject[]
}

export type OpenAPIDocument = { readonly [key: string]: unknown }

export interface WrittenDocument {
  readonly document: OpenAPIDocument
  readonly diagnostics: readonly Diagnostic[]
}

const METHOD_ORDER: readonly HTTPMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]

const JSON_MEDIA_TYPE = /^application\/(?:[^;]+\+)?json\s*(?:;|$)/i

const isJson = (mediaType: string) => JSON_MEDIA_TYPE.test(mediaType)

/** The components bodies that are not JSON use, and the components everything else uses, directly or through other components. */
const componentUses = (model: ApiModel<ComponentName>) => {
  const reached = {
    json: new Set<ComponentName>(),
    raw: new Set<ComponentName>(),
  }
  const visit = (shape: Shape<ComponentName>, raw: boolean) => {
    const seen = raw ? reached.raw : reached.json
    for (const { target } of refsOf(shape))
      if (!seen.has(target)) {
        seen.add(target)
        visit(model.types[target].shape, raw)
      }
  }
  const visitContent = (
    content: Readonly<Record<string, MediaType<ComponentName>>>
  ) => {
    for (const [type, { shape }] of Object.entries(content))
      visit(shape, !isJson(type))
  }
  const visitResponse = ({ headers, content }: Response<ComponentName>) => {
    for (const { shape } of headers) visit(shape, false)
    visitContent(content)
  }
  for (const op of model.operations) {
    for (const { shape } of op.parameters) visit(shape, false)
    if (op.requestBody) visitContent(op.requestBody.content)
    for (const slot of Object.values(op.responses))
      if (slot.kind === 'inline') visitResponse(slot.response)
  }
  Object.values(model.responses).forEach(visitResponse)
  return reached
}

const RAW_TWIN_SUFFIX = '_raw'

/**
 * How raw bodies and JSON share components. A component only raw bodies use
 * is written as a raw body. One that both use and that holds raw bytes gets
 * a raw twin, `<name>_raw` or the next free `_2`, `_3`, ..., which raw bodies
 * refer to instead.
 */
const rawComponents = (
  model: ApiModel<ComponentName>,
  capabilities: Capabilities
) => {
  const uses = componentUses(model)
  const rawOnly = new Set([...uses.raw].filter((name) => !uses.json.has(name)))
  const shared = [...uses.raw]
    .filter(
      (name) =>
        uses.json.has(name) &&
        holdsRawBytes(capabilities, model.types, model.types[name].shape)
    )
    .sort()
  // a twin's name is made up, so yielding to a taken name is no conflict
  const { names } = allocate<string>([
    ...Object.keys(model.types).map((name) => ({ owner: name, name })),
    ...shared.map((name) => ({
      owner: `twin:${name}`,
      name: `${name}${RAW_TWIN_SUFFIX}`,
    })),
  ])
  const twins = new Map(
    shared.map((name) => [name, names.get(`twin:${name}`) as ComponentName])
  )
  return { rawOnly, twins }
}

const byName = <T>([a]: [string, T], [b]: [string, T]) =>
  a < b ? -1 : a > b ? 1 : 0

const sortedEntries = <T>(record: Readonly<Record<string, T>>) =>
  Object.entries(record).sort(byName)

const nonEmpty = <T extends object>(key: string, value: T) =>
  Object.keys(value).length > 0 ? { [key]: value } : {}

/** `/users/:id` -> `/users/{id}`, with the param grammar of `@t-rest/protocol`. */
const openAPIPath = (path: string) => path.replace(/:(\w+)/g, '{$1}')

const securityRequirements = (security: Security) =>
  security.map((requirements) =>
    Object.fromEntries(
      requirements.map(({ scheme, scopes }) => [scheme, scopes])
    )
  )

const server = ({ url, description, variables }: Server) =>
  compact({ url, description, variables })

/**
 * The OpenAPI document of one selected spec for `target`. Pure; key order is
 * fixed here and paths and components are sorted, so equal models give
 * byte-equal documents.
 */
export const writeDocument = (
  model: ApiModel<ComponentName>,
  target: Target,
  options: DocumentOptions
): WrittenDocument => {
  const capabilities = CAPABILITIES[target]
  const diagnostics: Diagnostic[] = []
  const report = (found: Diagnostic) => diagnostics.push(found)
  const raw = rawComponents(model, capabilities)
  const context = {
    capabilities,
    types: model.types,
    report,
    rawTwins: raw.twins,
  }
  const schema = schemaWriter({ ...context, rawBody: false })
  const rawBodySchema = schemaWriter({ ...context, rawBody: true })

  const media = (
    type: string,
    { shape, examples, encoding }: MediaType<ComponentName>,
    pointer: string
  ) =>
    compact({
      schema: (isJson(type) ? schema : rawBodySchema)(
        shape,
        pointerTo(pointer, 'schema')
      ),
      examples:
        examples &&
        Object.fromEntries(
          Object.entries(examples).map(([name, example]) => [
            name,
            compact({
              summary: example.summary,
              description: example.description,
              value: example.value,
            }),
          ])
        ),
      encoding,
    })

  const content = (
    entries: Readonly<Record<string, MediaType<ComponentName>>>,
    pointer: string
  ) =>
    Object.fromEntries(
      Object.entries(entries).map(([type, entry]) => [
        type,
        media(type, entry, pointerTo(pointer, type)),
      ])
    )

  const parameter = (
    { name, in: location, required, shape, encoding }: Parameter<ComponentName>,
    pointer: string
  ) => ({
    name,
    in: location,
    required,
    ...(encoding === 'json'
      ? {
          content: content(
            { 'application/json': { shape } },
            pointerTo(pointer, 'content')
          ),
        }
      : { schema: schema(shape, pointerTo(pointer, 'schema')) }),
  })

  const response = (
    { description, headers, content: body }: Response<ComponentName>,
    pointer: string
  ) => ({
    description,
    ...nonEmpty(
      'headers',
      Object.fromEntries(
        headers.map(({ name, required, shape }) => [
          name,
          {
            ...(required && { required }),
            schema: schema(
              shape,
              pointerTo(pointer, 'headers', name, 'schema')
            ),
          },
        ])
      )
    ),
    ...nonEmpty('content', content(body, pointerTo(pointer, 'content'))),
  })

  const responseSlot = (slot: ResponseSlot<ComponentName>, pointer: string) =>
    slot.kind === 'shared'
      ? { $ref: `#/components/responses/${slot.id}` }
      : response(slot.response, pointer)

  const operation = (op: Operation<ComponentName>, pointer: string) => ({
    ...(op.tags.length > 0 && { tags: op.tags }),
    ...compact({
      summary: op.summary,
      description: op.description,
      externalDocs: op.externalDocs,
    }),
    operationId: op.operationId,
    ...(op.parameters.length > 0 && {
      parameters: op.parameters.map((entry, index) =>
        parameter(entry, pointerTo(pointer, 'parameters', index))
      ),
    }),
    ...(op.requestBody && {
      requestBody: {
        ...(op.requestBody.required && { required: true }),
        content: content(
          op.requestBody.content,
          pointerTo(pointer, 'requestBody', 'content')
        ),
      },
    }),
    responses: Object.fromEntries(
      Object.entries(op.responses).map(([status, slot]) => [
        status,
        responseSlot(slot, pointerTo(pointer, 'responses', status)),
      ])
    ),
    ...(op.deprecated && { deprecated: true }),
    // no top-level security is written, so an operation without one is public
    ...(op.security.length > 0 && {
      security: securityRequirements(op.security),
    }),
    ...(op.servers && { servers: op.servers.map(server) }),
    ...Object.fromEntries(
      Object.entries(op.extensions).filter(([key]) => key.startsWith('x-'))
    ),
  })

  const paths = new Map<string, Operation<ComponentName>[]>()
  for (const op of model.operations) {
    const path = openAPIPath(op.path)
    paths.set(path, [...(paths.get(path) ?? []), op])
  }
  const pathItems = Object.fromEntries(
    [...paths].sort(byName).map(([path, operations]) => [
      path,
      Object.fromEntries(
        [...operations]
          .sort(
            (a, b) =>
              METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method)
          )
          .map((op) => {
            const method = op.method.toLowerCase()
            return [method, operation(op, pointerTo('/paths', path, method))]
          })
      ),
    ])
  )

  const components = {
    ...nonEmpty(
      'schemas',
      Object.fromEntries(
        [
          ...Object.entries(model.types).map(([name, { shape }]) => ({
            name,
            shape,
            write: raw.rawOnly.has(name as ComponentName)
              ? rawBodySchema
              : schema,
          })),
          ...[...raw.twins].map(([name, twin]) => ({
            name: twin as string,
            shape: model.types[name].shape,
            write: rawBodySchema,
          })),
        ]
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
          .map(({ name, shape, write }): [string, SchemaObject] => [
            name,
            write(shape, pointerTo('/components/schemas', name)),
          ])
      )
    ),
    ...nonEmpty(
      'responses',
      Object.fromEntries(
        sortedEntries(model.responses).map(([id, shared]) => [
          id,
          response(shared, pointerTo('/components/responses', id)),
        ])
      )
    ),
    ...nonEmpty(
      'securitySchemes',
      Object.fromEntries(sortedEntries(model.securitySchemes))
    ),
  }

  const declared = options.tags ?? []
  const declaredNames = new Set(declared.map(({ name }) => name))
  const undeclared = [...new Set(model.operations.flatMap(({ tags }) => tags))]
    .filter((tag) => !declaredNames.has(tag))
    .sort()
  for (const tag of undeclared)
    report(diagnostic('writer/tag-undeclared', {}, { tag }))
  const tags = [
    ...declared.map(({ name, description, externalDocs }) =>
      compact({ name, description, externalDocs })
    ),
    ...undeclared.map((name) => ({ name })),
  ]

  const { title, description, contact, license, version } = options.info
  const document = {
    openapi: capabilities.openapi,
    info: compact({ title, description, contact, license, version }),
    ...(options.servers &&
      options.servers.length > 0 && { servers: options.servers.map(server) }),
    ...(tags.length > 0 && { tags }),
    paths: pathItems,
    ...nonEmpty('components', components),
  }

  return { document, diagnostics }
}
