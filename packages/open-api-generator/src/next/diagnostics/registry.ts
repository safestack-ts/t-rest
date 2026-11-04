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
  'naming/duplicate-id': define<{ id: string }>()({
    severity: 'error',
    configurable: false,
    title: 'Two schemas share one id',
    trigger:
      'Two different schemas carry the same id (`.meta({ id })` or `defineModels`) inside one conversion or across routes.',
    fix: 'Give each schema its own id, or reuse one schema value instead of two equal-looking ones.',
    message: (d) => `two different schemas use the id "${d.id}"`,
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
