# Contract for issue #68 (authoritative)

This file is the single contract. It supersedes `synthesis.md`. The base design `candidate-1/design.md` and `candidate-1/sketch/*.ts` are reference material only. Where this file is silent, follow the base. Where this file and the base disagree, this file wins. Every rule below that came from the adversarial review names the reviewers who raised it (A opus, B opus-high, C sonnet, D haiku).

## 1. Core route API (`@t-rest/core`)

### 1.1 Response descriptors (PR 1)
- `ResponseDescriptor<TKind, TContentType, TBody>` keeps its three type parameters. It gains optional, non-generic runtime fields: `schema?: StandardSchemaV1`, `description?: string`, `headers?: StandardSchemaV1` (an object schema; one header per property), `examples?: Record<string, { summary?: string; description?: string; value: unknown }>`, `id?: string`.
- `json` overloads: `json<T>()` (unchanged, phantom body), `json<T>(options)` (docs while migrating, no schema), `json(schema, options?)` with `TBody = StandardSchemaV1.InferOutput<S>` and `examples` typed `Record<string, { value: TBody, ... }>`. Runtime discriminates on `'~standard' in arg`. `json<T>(schema)` must not compile.
- A descriptor built without options must stay deep-equal to today's object (no `undefined` keys).
- `text(ct?, options?)`, `binary(ct, options?)`, `empty(options?)` accept `description` and `headers`. `text` also accepts `examples` typed `string`.
- `emptyValidation` implements `StandardJSONSchemaV1`: `~standard.jsonSchema.input()` and `.output()` both return `{ type: 'object' }`. Its vendor becomes `'t-rest'` (migration note).
- Core's `@standard-schema/spec` dependency stays; core's zod peer range is raised to the first zod 4 minor that ships `~standard.jsonSchema` (verify with `npm view zod@4 version` history and the zod changelog; record the evidence in the PR body).

### 1.2 RouteMeta, security, request examples (PR 2)
- `RouteMeta` moves into core as a TS interface with all-optional fields: `summary`, `description`, `tags: readonly string[]`, `deprecated`, `operationId`, `externalDocs`, `servers`, `security`. `headers` is removed (headers come from the validator's `headers` key).
- `.metaData()` is typed with a self-checking constraint (B, verified): `metaData<T extends CheckMeta<T>>(m: T)` where `type CheckMeta<T> = { [K in keyof T]: K extends keyof RouteMeta ? RouteMeta[K] : unknown }`. Required type tests: `{ public: true }` alone compiles and keeps `public: boolean`; a shared variable and an interface-typed value compile; `{ tags: 'x' }` fails; `{ summary: 's', public: true }` keeps both.
- Routes without `.metaData()` keep their current meta type unless a type test proves `{}` is needed; do not change it gratuitously.
- Security schemes are values: `securityScheme(name, spec)` returns a branded `SecurityScheme<Name, Spec>`. `meta.security: SecurityRequirements` is OR of ANDs: `readonly (readonly SchemeRef[])[]`, where `SchemeRef` is a scheme or `oauth.scopes(...scopes)` typed against the scheme's declared scope names. `[]` = public, `[[bearer], []]` = optional auth. The model and the output still use scheme names.
- Request examples: `.validate(schema, { examples })`, typed `Record<string, { value: InferInput<TValidator>, ... }>` using the conditional form `TValidator extends StandardSchemaV1 ? StandardSchemaV1.InferInput<TValidator> : never` so the existing unconstrained `validate({})` call sites keep compiling (A). Stored on `RouteDef.requestExamples`.
- Response examples live only on descriptors. `meta.examples` (issue §9) is not implemented; this is a recorded deviation because `.metaData()` can run before the route type exists.

### 1.3 Bag defaults (PR 2)
- `bag.withDefaultResponses(map)` on the built `BagOfRoutes` returns a new `BagOfRoutes` whose routes carry `{ ...defaults, ...route.responses }` (route wins) at runtime and at type level. The type must be written against the real `RouteDef` (A, B, C, D): `(Omit<TDefaults, keyof R> & R) extends infer X extends StrictResponseMap<X> ? RouteDef<V, M, P, Val, X, Meta, Enc> : never` (B, verified) or A's mapped merge. Type tests run against `packages/core/src` types, never a stand-in: `DeclaredStatus` includes the default status; an undeclared status is still rejected; a route's own status body wins; the result extends `AnyRouteDef`; `RoutesOf` inference on the returned bag still works.
- Idempotent: applying the same defaults twice yields deep-equal routes. `combine()` is unchanged.
- There is no `withDefaultSecurity`. Default security is generator config only (A, B, D): security has no client or server runtime effect, so it does not need to live on routes.

### 1.4 `defineModels` (PR 3, `@t-rest/core/zod`)
- `defineModels(namespace, { Key: schema })` derives `id = namespace.replaceAll('.', '_') + '_' + Key`, validates it against `^[A-Za-z0-9_]+$` at call time, and returns the same keys with the same types.
- A schema with no id is registered in place with `schema.register(z.globalRegistry, { ...z.globalRegistry.get(schema), id })` so existing metadata such as `description` is preserved (C) and parents defined earlier pick the id up.
- A schema that already has an id (from `.meta({ id })` or an earlier `defineModels`) gets an alias clone: `schema.meta({ id })`, which zod emits as a `$ref`-only def.
- No definition-time throw on id clashes (A, B, C, D): module re-evaluation (HMR, `vi.resetModules()`) creates new objects with the same ids. Conflicts are caught at generation time by shape comparison.
- Documented rule: pass a schema to `defineModels` once and reuse the returned value; a second `defineModels` over the same object creates an alias, and which call owns the base id follows evaluation order. The lint rule (PR 10) does not try to detect this.

## 2. Generator (`@t-rest/open-api-generator`)

New code lands unexported under `packages/open-api-generator/src/next/` until the switch PR (9) moves it to `src/` and deletes the old pipeline in the same PR.

### 2.1 Model and document format (PR 4)
- `ApiModel<R>` is generic over the reference type. Pipeline types may brand `DefKey` and `ComponentName`; the serialized `ApiModelDocument` uses plain strings (A, B, C, D: zod cannot produce local `unique symbol` brands).
- The document schema is written in zod (`model/document-schema.ts`). `ApiModelDocument = z.infer<typeof apiModelDocumentSchema>`. A compile-time test asserts the pipeline's `ApiModel<ComponentName>` is assignable to `ApiModelDocument` and back, after stripping brands. The published JSON Schema (`schema/api-model.v1.schema.json`) is generated from the zod schema and drift-checked by a vitest file snapshot. `parseApiModel(json)` uses the zod schema.
- zod stays a peer dependency of the generator (`^4.<first jsonSchema minor>`), resolving A and B's contradiction; the document schema registers no ids, so it does not touch the user's global registry.
- `null` is a union member; optionality lives on fields and parameters. A literal is a one-member enum. Enum member names come only from `x-enum-varnames` (or `x-enumNames`). Docs on every node: `description`, `examples`, `default`, `deprecated`, `readOnly`, `writeOnly`, `format`, constraints, `x-*` extensions.
- `Operation.key` is built from the normalized path (params by position, for example `GET /users/{} @2024-01-01`), with param names kept as data (A, B, D).
- `Operation.security` is always an explicit resolved list after selection; "not declared" does not exist in the document (B).
- Operation extensions (consumer meta keys) keep only JSON-serializable values; any other value (a function, a scheme object, a Date) gives `operation/meta-not-serializable` (C).
- `MODEL_VERSION_HISTORY` is a const array; the document's `modelVersion` derives from its last entry, and the changelog doc is rendered from it.
- Anonymous types that must be referencable (recursion that survives unification, see 2.3) are keyed by their first use: `anon:<operation key>#<slot>#<json pointer>`, over operations sorted by key. No content hashes in the document (C).

### 2.2 Diagnostics (PR 4)
- One `as const` table: code, default severity, `configurable`, title, trigger, fix, typed message. `DiagnosticCode` and `ConfigurableCode` derive from it. Messages end with a docs anchor. Nothing writes to `console`. `write()` rejects with `OpenAPIGenerationError` (carrying `diagnostics`) on any error and writes nothing.

### 2.3 Reader (PR 5)
- Requests read `jsonSchema.input`, responses read `.output`, target `draft-2020-12`. Cache: one `WeakMap<object, { input?, output? }>` per run, never module-global.
- On a throw, retry once with the vendor policy's lenient options (zod: `{ unrepresentable: 'any' }`). Response slot: `schema/unrepresentable` is an error by default, configurable (A, D: a response body that cannot be represented usually means the body type is not JSON). Request slot: warning; downgraded to info when every unrepresentable field is covered by `route.multipartFiles` (B). Message says "possible placeholders" for `{}` pointers (A, C).
- zod's "Duplicate schema id" throw is classified as `naming/duplicate-id`, not a conversion failure (A).
- Vendor policy table keyed by `~standard.vendor`: zod trust (generated keys `^__schema\d+$` are not ids), valibot trust-when-named, arktype inline, `t-rest` trust, unknown vendors inline unless `config.vendors.trust` lists them.
- Generated-def unification (A, B, C, D): after reading one conversion into a graph, run partition refinement (bisimulation minimization) over every node, seeded so that annotation-only differences (description, examples, title) do not separate nodes and named defs are distinguished by id. Replace every node bisimilar to a named def with a ref to it (ties go to the lexicographically smallest id). Then inline any generated def that is no longer on a cycle. Recursion left over (inline-policy vendors, `$ref: "#"` roots, anonymous cycles) becomes an anonymous type (2.1). `$ref: "#"` resolves to the converted root (D). Golden tests: array recursion via a clone (`R0.meta({ id })`), nullable recursion, optional recursion, mutual recursion with one side named, a `z.lazy` root tree, two distinct structures that share one unfolding.
- Normalization rule table, matched on JSON Schema shapes:
  - `safe-integer-bounds`: drop `minimum`/`maximum` equal to ∓/±`Number.MAX_SAFE_INTEGER` on `type: integer`, only for vendors whose policy says integers are safe integers (zod) (D). Note in the target docs that the bound is implied.
  - `open-output-objects`: closedness of a response object is taken from the input conversion of the same schema (B). For every response schema also run `.input()` (cached; a throw means "open"). Output `additionalProperties: false` stays only where the input conversion also has it (a strict object). This keeps plain response objects open, keeps 3.0 byte-compatible, and does not depend on other routes.
  - `readonly-input`: drop `readOnly: true` in the input direction (B: zod `.readonly()` is TS immutability, and OpenAPI `readOnly` in a request tells clients to omit the field).
- Keywords: `not: {}` and `false` map to `never` (B). Every other unsupported validation keyword (`not`, `if/then/else`, `patternProperties`, `contains`, `dependent*`, `unevaluated*`) gives `schema/unsupported-keyword` (warning) saying the documented schema is wider. Unknown annotation keywords and `x-*` go to docs/extensions.
- Request split: dereference the root, split `properties.params/query/body/headers`; other root keys give `schema/unknown-request-slot` except multipart file keys. Path params missing from the validator are derived from the path pattern as `string` (D).

### 2.4 Operations and transport (PR 6)
- Query parameter encoding is decided from the wire (A): if any member of the dereferenced shape (through unions and null) is an object, array or tuple, the parameter is `encoding: 'json'` and documents the object/array branch as `content: application/json`. Fixture: `ze.jsonObject`.
- Multipart: file parts from `route.multipartFiles` replace their fields with binary strings (arrays when `multiple`), merge `required`, set multipart `encoding`.
- `requestBody.required` from the body slot. Response description from the descriptor, else the reason phrase. Response headers from `descriptor.headers` (output). Global headers are one Standard Schema (input); route headers win, matched case-insensitively.
- Security precedence (A, B, D): `meta.security`, else `securityFromHeaders` when the route's validator declares the bridged header (required header gives `[[s]]`, optional gives `[[s], []]`), else `config.security` (the bag default). A header covered by a scheme in effect is removed from parameters. Declaring both a covered header and the scheme in `meta.security` gives `security/header-and-scheme`. Scheme-name conflicts compare scheme specs structurally (B).
- Examples: request examples are validated through the route validator. Response examples are validated through the descriptor schema only when the input and output conversions of that schema are equal after normalization; otherwise `operation/example-unverifiable` (info) (B, C).
- `operationId`: `meta.operationId`, else `config.operationId(route)`, else a default derivation; uniqueness checked per spec.

### 2.5 Naming, selection, pruning (PR 7)
- Names are computed once over the whole bag, so filtered specs share names.
- Direction merge is a greatest fixpoint (A, B): `input:X` and `output:X` merge iff their normalized shapes are equal assuming every referenced pair merges. Compute by partition refinement over the pair graph. Unmerged pairs: output keeps `X`, input gets `X + naming.inputSuffix` (default `Input`), info diagnostic `naming/direction-split`. Docs must say a nested `.default()` splits every ancestor.
- Aliases: `reference` (default, a `$ref`-only component, target still emitted) or `materialize` (shallow copy).
- `naming.nameAnonymous(ctx)` names anonymous slot-root objects and anonymous recursive types. Without a name, an anonymous recursive type gets the fallback `${operationId}_${pointer}` and `naming/anonymous-recursion` (warning).
- `naming/probable-model-without-id` (warning, configurable) considers only body and response slot roots and their nested objects with at least 2 fields, appearing in 2 or more operations (B).
- Shared responses (`components.responses`) come from descriptors with an `id`; two descriptors with the same id are one shared response iff they have the same schema object and equal docs fields; otherwise `naming/duplicate-response-id` (D).
- Selection keeps today's semantics: filter runs per revision on `RouteView { method, path, version, meta }` with typed meta, before version resolution (NONE: every route; DATE: `resolveDateVersion`; SEMVER: `resolveVersion`; newer than the spec version dropped). Path normalization by position. Pruning keeps only reachable types, responses and schemes.

### 2.6 Writer and output (PR 8)
- One writer, one `CAPABILITIES` table, `CAPABILITY_DOCS: { [K in keyof Capabilities]: string }`. Columns only for real differences: null style and nullable ref, literal style (`const` vs one-value `enum`), tuple encoding, exclusive bounds, Schema Object `example` vs `examples` (the 3.0 Media Type Object keeps its `examples` map, B), `$ref` siblings, binary encoding, `propertyNames`. No constant or unused columns (A, B). An ESLint `no-restricted-syntax` rule scoped to `packages/open-api-generator/src/next/writer/**` (later `src/writer/**`) forbids the target literals outside `capabilities.ts`.
- 3.0 keeps today's encodings: `nullable: true`, nullable ref `oneOf: [$ref, { type: string, enum: [null], nullable: true }]`, one-value enums, tuples as `anyOf` items plus min/max, sorted components. Each approximation gives `writer/downgrade` with the capability name and a pointer.
- Discriminator: inferred only when exactly one property is a required single-literal with unique values across all object members (B); emitted only when every non-null member is a ref; otherwise `writer/discriminator-not-emitted`.
- Output: format from the extension (`.yaml`, `.yml`, `.json`); `output` is typed `string`, with `{version}` and extension checked at runtime by `config/output-template` (B). Deterministic key order. `write()` stages every file as a temp file in its target dir and renames each; the docs say atomic per file, not across the set (A, C, D).
- Sidecar: `<spec basename>.api-model.json` next to each spec holds that spec's selected and pruned model, never the whole bag (A, B, C). Two outputs mapping to one sidecar path give `output/path-collision`.
- Verification (built in PR 4, used in PR 8): every emitted document validates against the vendored official OpenAPI 3.0 (via `ajv-draft-04`), 3.1 and 3.2 meta-schemas. If no official 3.2 meta-schema can be vendored, 3.2 is dropped from PR 8 and added when one exists (D); do not validate 3.2 against 3.1 silently. The 3.0 baseline comparison runs on a normalized projection (`components.schemas` encodings, plus parameter and media-type schema encodings), against a fixed reviewed allowlist of named differences with a reason each (B, D).

### 2.7 Public API (PR 9)
- Root exports only: `buildOpenAPI(config)` (pure, returns `{ model, specs: [{ output, target, document, model }], diagnostics, write() }`), `parseApiModel`, `apiModelJsonSchema`, `OpenAPIGenerationError`, and the config, diagnostic, document and target types. Deleted: `OpenAPIGenerator`, `OpenAPISpec`, the IR, `validateRouteMeta`, `Header`, the naming options, the `typescript` peer, `lodash`, `debug`, `stable-hash` (unless the reader keeps it), and the CI TypeScript 5.7 job. The package joins `scripts/api-snapshot.mjs`.
- Config: `bag`, `info` (title, description, version, contact, license), `servers`, `tags`, `securitySchemes` (extra schemes beyond the reachable ones), `security` (bag default), `securityFromHeaders`, `headers` (global, one Standard Schema), `operationId` hook, `naming` (`aliases`, `inputSuffix`, `nameAnonymous`, `models`), `vendors.trust`, `diagnostics` (severity overrides for configurable codes), `specs: [{ version | versions: 'all' | V[], target, output, filter? }]`.

## 3. `@t-rest/oxlint-plugin` (PR 10)
- One rule `require-model-id`, ESLint-format `{ meta, create }`, no runtime dependencies. Accepts a chain that contains `.meta({ id })` followed only by non-deriving wrappers (`.describe`, `.meta`, `.readonly`) (B).
- Tests: ESLint `RuleTester` with `@typescript-eslint/parser`, the restricted-context proxy test, and a plugin-shape test. Before PR 10 is called green, install oxlint in a scratch directory outside the repo and run the rule against a fixture; record the version and output in the PR body (D). If that cannot run, the README claims "ESLint-compatible, designed for oxlint JS plugins" and nothing stronger.

## 4. Docs (PR 11) and generated docs (PR 4 onward)
- Generated by vitest `toMatchFileSnapshot` inside `pnpm test`: `docs/open-api-generator/diagnostics.md`, `api-model.md` plus `api-model.v1.schema.json`, `targets.md`. No new CI job.
- Written guides per issue §11, `docs/architecture.md`, generator and plugin READMEs, a migration guide (must cover: removed options, `json<T>()` to `json(schema)`, `defineModels`, one-time renames, security migration, `meta.examples` deviation, `emptyValidation` vendor change, `metaData` known-key typing, the default 400 body being app-enforced not framework-enforced (D)), and a playground example with a vitest smoke test.

## Lead judgment record

- Act on: every rule above tagged with reviewers.
- Consider (not acted on now, recorded for the PR bodies):
  - A type-level JSON constraint on `json(schema)` output (A, D). Rejected for now because `z.unknown()`, interfaces and optional fields make a `JsonValue` constraint produce false rejections; the runtime `schema/unrepresentable` error on response slots covers the real failure.
  - Whole-bag direction splits can rename a public request component when an internal route starts returning it in a different shape (C, D). Kept because issue §3 requires names computed once; the §8 diff treats renames as non-breaking. Documented in the naming guide.
  - Typed response headers on descriptors (B). Additive later.
- Noted: core security scheme specs and `RouteMeta.externalDocs/servers` use OpenAPI vocabulary on purpose (D); typo-distance diagnostics for meta keys (A).
- Dismissed: replacing the `Shape` IR with normalized JSON Schema 2020-12 as the canonical form (D). Issue §2 decides a format-neutral model (null as a union member, enum names, discriminators, generic over the reference type) as the input for the §8 diff; the IR is that decision, not an accident.
