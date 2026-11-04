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
  'naming/reserved-response-id': define<{ id: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Response id is reserved',
    trigger:
      'A response descriptor has the `id` `__proto__`, which JSON and the model document drop as a record key. The response is documented inline.',
    fix: 'Give the descriptor another `id`.',
    message: (d) => `the response id "${d.id}" is reserved`,
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
  'security/reserved-scheme-name': define<{ name: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Security scheme name is reserved',
    trigger:
      'A `securityScheme()` is named `__proto__`, which JSON and the model document drop as a record key. The scheme is left out of the model.',
    fix: 'Give the scheme another name.',
    message: (d) => `the security scheme name "${d.name}" is reserved`,
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
  'naming/direction-split': define<{ id: string; input: string }>()({
    severity: 'info',
    configurable: false,
    title: 'Input and output of one id differ',
    trigger:
      'A schema with an id reads differently as request input and as response output, so it becomes two components: the output keeps the id, the input gets `naming.inputSuffix` (default `Input`). A nested `.default()`, `.transform()` or `.readonly()` splits the type that contains it and every type above it, since their inputs refer to the split input.',
    fix: 'Nothing to do. To keep one component, use the schema in one direction only, or move the default out of the shared type.',
    message: (d) =>
      `"${d.id}" reads differently as input; the input is named "${d.input}"`,
  }),
  'naming/anonymous-recursion': define<{ name: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Recursive schema without id',
    trigger:
      'A schema refers to itself but has no id, and `naming.nameAnonymous` did not name it. Inside a named type it is named after that type and its JSON pointer there; elsewhere after the operationId, the slot and the JSON pointer of its first use, which changes when the route does. Equal recursive schemas share one name; two different ones with one fallback name get a numeric suffix.',
    fix: 'Give the recursive schema an id (`.meta({ id })` or `defineModels`), or name it in `naming.nameAnonymous`.',
    message: (d) => `a recursive schema without id is named "${d.name}"`,
  }),
  'naming/probable-model-without-id': define<{
    fields: string[]
    operations: string[]
  }>()({
    severity: 'warning',
    configurable: true,
    title: 'Probable model without id',
    trigger:
      'Request or response bodies of two or more operations contain the same inline object with at least two fields. It is inlined in each of them, so clients get one type per use.',
    fix: 'Give the schema an id (`.meta({ id })` or `defineModels`) and reuse it, or lower the severity in `config.diagnostics`.',
    message: (d) =>
      `an object with ${list(d.fields)} is repeated without id in ${list(
        d.operations
      )}`,
  }),
  'naming/component-conflict': define<{ name: string; owners: string[] }>()({
    severity: 'error',
    configurable: false,
    title: 'Two components want one name',
    trigger:
      'Two different types or shared responses end up with the same component name: ids that differ only in characters a component name cannot hold, an id that equals another id plus the input suffix, or one name from `naming.nameAnonymous` for different shapes. The later one gets a numeric suffix. Two fallback names of `naming/anonymous-recursion` that clash are not a conflict.',
    fix: 'Rename one of the ids, or return different names from `naming.nameAnonymous`.',
    message: (d) =>
      `the component name "${d.name}" is wanted by ${list(d.owners)}`,
  }),
  'operation/duplicate-operation-id': define<{
    operationId: string
    operations: string[]
  }>()({
    severity: 'error',
    configurable: false,
    title: 'Two operations share one operationId',
    trigger:
      'Two operations of one spec have the same `operationId`, from `meta.operationId`, the `operationId` hook or the derived default.',
    fix: 'Set a unique `meta.operationId` on one of the routes, or make the hook return unique ids.',
    message: (d) =>
      `operationId "${d.operationId}" is used by ${list(d.operations)}`,
  }),
  'writer/downgrade': define<{ capability: string; target: string }>()({
    severity: 'warning',
    configurable: true,
    title: 'Schema approximated for the target',
    trigger:
      'The OpenAPI target cannot express a part of a schema, so the document describes it less precisely: tuple elements of different types, more than one schema example, a constrained `propertyNames`, or a non-`x-` annotation keyword in 3.0. The pointer locates the schema in the emitted document; `targets.md` describes each capability.',
    fix: 'Target a newer OpenAPI version, accept the approximation, or lower the severity in `config.diagnostics`.',
    message: (d) =>
      `OpenAPI ${d.target} approximates "${d.capability}" here, see targets.md`,
  }),
  'writer/discriminator-not-emitted': define<{ property: string }>()({
    severity: 'info',
    configurable: false,
    title: 'Discriminator not emitted',
    trigger:
      'Every object member of a union has a required property with one string literal, unique across the members, but a member is an inline object rather than a component. A discriminator maps values to components, so none is emitted.',
    fix: 'Give each member an id (`.meta({ id })` or `defineModels`) to get a discriminator.',
    message: (d) =>
      `the union is discriminated by "${d.property}", but a member is not a component`,
  }),
  'writer/tag-undeclared': define<{ tag: string }>()({
    severity: 'info',
    configurable: true,
    title: 'Tag used but not declared',
    trigger:
      'An operation uses a tag that `config.tags` does not declare. The tag is appended to the document tags without a description.',
    fix: 'Declare the tag in `config.tags`, with a description.',
    message: (d) => `tag "${d.tag}" is used but not declared`,
  }),
  'output/path-collision': define<{ path: string; outputs: string[] }>()({
    severity: 'error',
    configurable: false,
    title: 'Two outputs write one file',
    trigger:
      'Two specs write the same file, either their `output` or their `<basename>.api-model.json` sidecar, e.g. `api.yaml` and `api.json`. Paths are compared ignoring case.',
    fix: 'Give the specs outputs with different base names.',
    message: (d) =>
      `more than one spec writes ${d.path} (outputs: ${list(d.outputs)})`,
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
