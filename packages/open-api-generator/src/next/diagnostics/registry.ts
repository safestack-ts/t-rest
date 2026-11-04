export type Severity = 'error' | 'warning' | 'info'

export const DIAGNOSTICS_DOCS_URL =
  'https://github.com/safestack-ts/t-rest/blob/main/docs/open-api-generator/diagnostics.md'

interface DiagnosticDefinition<TData, TConfigurable extends boolean> {
  readonly severity: Severity
  /** Whether `config.diagnostics` may change the severity. */
  readonly configurable: TConfigurable
  readonly title: string
  /** Markdown: what triggers it. */
  readonly trigger: string
  /** Markdown: how to resolve it. */
  readonly fix: string
  readonly message: (data: TData) => string
}

const define =
  <TData>() =>
  <TConfigurable extends boolean>(
    definition: DiagnosticDefinition<TData, TConfigurable>
  ) =>
    definition

const list = (items: readonly string[]) => items.join(', ')

export const DIAGNOSTICS = {
  'operation/meta-not-serializable': define<{ key: string; type: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Route meta value is not JSON',
    trigger:
      'A `.metaData()` key outside `RouteMeta` holds a value JSON cannot carry, such as a function, a class instance or a `Date`.',
    fix: 'Store plain JSON values in custom meta keys, or accept that the key is missing from `Operation.extensions`.',
    message: (d) =>
      `meta key "${d.key}" holds a ${d.type} and was left out of the model`,
  }),
  'schema/no-json-schema': define<{ vendor: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Schema without Standard JSON Schema',
    trigger:
      'A validator or response schema has no `~standard.jsonSchema`, so the generator cannot read its shape.',
    fix: 'Use a schema library version that implements Standard JSON Schema (`~standard.jsonSchema`).',
    message: (d) => `the ${d.vendor} schema has no ~standard.jsonSchema`,
  }),
  'schema/conversion-failed': define<{ error: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Schema conversion failed',
    trigger:
      'Converting the schema to JSON Schema threw, and the lenient retry threw too or the vendor has no lenient mode.',
    fix: 'Replace the part the error names with a JSON-representable schema.',
    message: (d) => `JSON Schema conversion failed: ${d.error}`,
  }),
  'schema/unrepresentable': define<{ error: string; placeholders: string[] }>()(
    {
      severity: 'error',
      configurable: true,
      title: 'Response body not representable',
      trigger:
        'A response schema contains a part JSON Schema cannot express (a `Date`, a transform output, a custom type). The lenient retry documents those parts as `{}`. A response body that cannot be represented is usually not JSON.',
      fix: 'Describe the body as it travels on the wire, for example `z.iso.datetime()` instead of `z.date()`, or lower the severity in `config.diagnostics`.',
      message: (d) =>
        `${d.error}; possible placeholders at ${list(d.placeholders)}`,
    }
  ),
  'schema/unrepresentable-request': define<{
    error: string
    placeholders: string[]
  }>()({
    severity: 'warning',
    configurable: true,
    title: 'Request part not representable',
    trigger:
      'A request validator contains a part JSON Schema cannot express. The lenient retry documents those parts as `{}`.',
    fix: 'Describe the field as it travels on the wire, or declare file fields in `.multipart({ files })`.',
    message: (d) =>
      `${d.error}; possible placeholders at ${list(d.placeholders)}`,
  }),
  'schema/multipart-placeholder': define<{
    error: string
    placeholders: string[]
  }>()({
    severity: 'info',
    configurable: false,
    title: 'Multipart file field not representable',
    trigger:
      'Every part of a request validator that JSON Schema cannot express is a file field declared in `.multipart({ files })`. The file part documentation replaces them.',
    fix: 'Nothing to do.',
    message: (d) =>
      `${d.error}; possible placeholders at ${list(
        d.placeholders
      )} are multipart file fields`,
  }),
  'schema/unsupported-keyword': define<{ keyword: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Unsupported JSON Schema keyword',
    trigger:
      'The schema uses a validation keyword the model cannot carry (`not`, `if`/`then`/`else`, `patternProperties`, `contains`, `dependent*`, `unevaluated*`). The keyword is dropped, so the documented schema accepts more values than the validator.',
    fix: 'Accept the wider documentation, or express the rule with supported keywords.',
    message: (d) =>
      `"${d.keyword}" is not supported; the documented schema is wider than the validator`,
  }),
  'schema/unknown-request-slot': define<{ key: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Unknown request validator key',
    trigger:
      'The request validator has a top-level key other than `params`, `query`, `headers` and `body`. t-rest never fills it, so it is not documented.',
    fix: 'Move the field into `params`, `query`, `headers` or `body`.',
    message: (d) => `request validator key "${d.key}" is not a request slot`,
  }),
  'schema/request-not-object': define<{ kind: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Request validator is not an object',
    trigger:
      'The request validator is not an object schema, for example a union of objects. Its slots cannot be split, so the request is not documented.',
    fix: 'Validate the request with one object schema whose keys are `params`, `query`, `headers` and `body`.',
    message: (d) =>
      `the request validator is ${d.kind}, not object; no request slot is documented`,
  }),
  'naming/duplicate-id': define<{ id: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Two schemas share one id',
    trigger:
      'Two different schemas carry the same id (`.meta({ id })` or `defineModels`) inside one conversion or across routes.',
    fix: 'Give each schema its own id, or reuse one schema value instead of two equal-looking ones.',
    message: (d) => `two different schemas use the id "${d.id}"`,
  }),
  'naming/duplicate-response-id': define<{ id: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Two responses share one id',
    trigger:
      'Two response descriptors carry the same `id` but differ in their schema object or their docs (`description`, `headers`, `examples`, content type). Each is documented inline instead of as one shared response.',
    fix: 'Create the descriptor once and reuse the value, or give each descriptor its own `id`.',
    message: (d) => `two different responses use the id "${d.id}"`,
  }),
  'naming/shared-response-without-description': define<{
    id: string
    statuses: string[]
  }>()({
    severity: 'warning',
    configurable: true,
    title: 'A shared response serves several statuses without a description',
    trigger:
      'A response descriptor with an `id` and no `description` is used for more than one status, e.g. one `json(Error, { id })` for 400 and 404. The shared response is documented with the reason phrases of every status it serves, e.g. "Bad Request or Not Found".',
    fix: 'Give the descriptor a `description` that fits every status, or create one descriptor per status.',
    message: (d) =>
      `the shared response "${d.id}" serves ${d.statuses.join(
        ', '
      )} without a description`,
  }),
  'operation/duplicate-route': define<{ paths: string[] }>()({
    severity: 'error',
    configurable: false,
    title: 'Two routes share one operation',
    trigger:
      'Two routes of one version have the same method and paths that differ only in parameter names, e.g. `/users/:id` and `/users/:userId`. Requests cannot tell them apart; only the first is documented.',
    fix: 'Remove one of the routes, or give them different paths.',
    message: (d) => `the routes ${list(d.paths)} are one operation`,
  }),
  'operation/invalid-meta': define<{ key: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Route meta value has the wrong type',
    trigger:
      "A `RouteMeta` key of `.metaData()` holds a value of another type at runtime, e.g. `tags: 'users'` behind a `@ts-expect-error`. The key is left out of the operation.",
    fix: 'Pass the value with the type `RouteMeta` declares for the key.',
    message: (d) => `meta key "${d.key}" has the wrong type and was left out`,
  }),
  'operation/example-invalid': define<{ example: string; issues: string[] }>()({
    severity: 'error',
    configurable: false,
    title: 'Example does not match its schema',
    trigger:
      'A request example (`.validate(schema, { examples })`) fails the route validator, or a response example fails the schema of its `json(schema, { examples })` descriptor. The example is left out.',
    fix: 'Correct the example value, or the schema if the example shows the intended data.',
    message: (d) =>
      `example "${d.example}" does not match its schema: ${list(d.issues)}`,
  }),
  'operation/example-unverifiable': define<{
    examples: string[]
    reason: string
  }>()({
    severity: 'info',
    configurable: false,
    title: 'Example not validated',
    trigger:
      'An example cannot be checked: its descriptor has no schema, its schema reads differently as input and as output (a default, a transform), or the validator only validates asynchronously. The example is documented as written.',
    fix: 'Nothing to do; check the example by hand.',
    message: (d) => `example(s) ${list(d.examples)} not validated: ${d.reason}`,
  }),
  'operation/mixed-query-encoding': define<{ parameter: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Query parameter mixes text and JSON values',
    trigger:
      'A query parameter accepts an object, array or tuple, which travels as JSON text, and also a plain string or string enum, which travels unquoted. The parameter is documented as JSON, so its text values are documented as JSON strings.',
    fix: 'Accept the structured value only, for example with `ze.jsonObject`, or move the text value to a parameter of its own.',
    message: (d) =>
      `query parameter "${d.parameter}" is documented as JSON, but its text values are sent unquoted`,
  }),
  'response/untyped-json': define<Record<string, never>>()({
    severity: 'warning',
    configurable: true,
    title: 'JSON response without schema',
    trigger:
      'A response is declared with `json<T>()`, so only TypeScript knows its body. It is documented as any JSON value.',
    fix: 'Pass the schema: `json(schema)`.',
    message: () =>
      'json<T>() has no schema; the body is documented as any JSON value',
  }),
  'security/header-and-scheme': define<{ header: string; scheme: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Header covered by a security scheme',
    trigger:
      'The route declares a header in its validator and a security scheme in `meta.security` that sends the same header (`authorization` for `http` and `oauth2` schemes, the header name of an `apiKey`, or a header mapped by `securityFromHeaders`). The header parameter is left out; the scheme documents it.',
    fix: "Remove the header from the validator's `headers`, or the scheme from `meta.security`.",
    message: (d) =>
      `header "${d.header}" is also sent by the security scheme "${d.scheme}"`,
  }),
  'security/scheme-name-conflict': define<{ name: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Two security schemes share one name',
    trigger:
      'Two `securityScheme()` values have the same name but different specs.',
    fix: 'Declare each scheme once and reuse the value, or give the schemes different names.',
    message: (d) => `two different security schemes use the name "${d.name}"`,
  }),
} as const

type Definitions = typeof DIAGNOSTICS

export type DiagnosticCode = keyof Definitions

export type ConfigurableCode = {
  [C in DiagnosticCode]: Definitions[C]['configurable'] extends true ? C : never
}[DiagnosticCode]

export type DiagnosticData<C extends DiagnosticCode> = Parameters<
  Definitions[C]['message']
>[0]

/** Where a diagnostic applies. A route-level diagnostic has `operation`. */
export interface Location {
  readonly operation?: string
  /** `params`, `query`, `headers`, `body`, `response 200`, ... */
  readonly slot?: string
  /** JSON pointer into the slot's schema. */
  readonly pointer?: string
}

export type Diagnostic = {
  [C in DiagnosticCode]: {
    readonly code: C
    readonly severity: Severity
    readonly at: Location
    readonly data: DiagnosticData<C>
    /** Ends with the link to the code's reference entry. */
    readonly message: string
  }
}[DiagnosticCode]

export const diagnosticAnchor = (code: DiagnosticCode) =>
  code.replace(/[^a-z0-9-]/g, '')

export const diagnostic = <C extends DiagnosticCode>(
  code: C,
  at: Location,
  data: DiagnosticData<C>
): Diagnostic => {
  // TS cannot correlate `DIAGNOSTICS[code]` with `DiagnosticData<C>` for a generic C
  const definition = DIAGNOSTICS[code] as unknown as DiagnosticDefinition<
    DiagnosticData<C>,
    boolean
  >

  return {
    code,
    severity: definition.severity,
    at,
    data,
    message: `${definition.message(
      data
    )} (${DIAGNOSTICS_DOCS_URL}#${diagnosticAnchor(code)})`,
  } as Diagnostic
}

export class OpenAPIGenerationError extends Error {
  readonly name = 'OpenAPIGenerationError'

  constructor(readonly diagnostics: readonly Diagnostic[]) {
    const errors = diagnostics.filter((d) => d.severity === 'error')
    super(
      [
        `OpenAPI generation failed with ${errors.length} error(s):`,
        ...errors.map((d) => `  ${d.code}: ${d.message}`),
      ].join('\n')
    )
  }
}
