# Architecture

typed-rest declares a REST contract once and derives the server, the client and the test adapter from it. Types flow from `@t-rest/core`; the runtime rules both ends of the wire must agree on live in `@t-rest/protocol`.

## Packages

| Package | Role | Runtime dependencies |
|---|---|---|
| `@t-rest/protocol` | Wire rules: HTTP methods and which send a body, the `:param` path grammar, path joining, query encoding/decoding, `buildUrl`/`planRequest`, the version header convention. Plain functions and data only. | none |
| `@t-rest/core` | The contract: `Route` builders, `RouteDef`, `BagOfRoutes`, version resolution, `ValidationError`, the type algebra the bindings derive from. Documentation that belongs to a route: response descriptor options, `RouteMeta`, `securityScheme()`, `withDefaultResponses`. `ze` zod helpers and `defineModels` on `@t-rest/core/zod` (`ze` is also re-exported from the root). | protocol, zod (peer) |
| `@t-rest/express-server` | Server binding: typed applications and routers on top of express 4 and 5. | core, protocol, express (peer) |
| `@t-rest/client` | Client binding: `RESTClient` over a pluggable `HTTPAdapter` (axios adapter at `@t-rest/client/axios`). | protocol |
| `@t-rest/supertest-adapter` | Test binding: typed supertest calls against a typed express application. | core, protocol, express-server, supertest |
| `@t-rest/client-utils` | Deprecated, re-exports `buildUrl` from protocol. | protocol |
| `@t-rest/open-api-generator` | Documentation binding: OpenAPI 3.0, 3.1 and 3.2 documents and `api-model.json` sidecars from a bag, read through Standard JSON Schema. Build-time only. | core, protocol, http-status-codes, yaml, zod (peer) |
| `@t-rest/oxlint-plugin` | Lint binding: the `t-rest/require-model-id` rule, which requires an id on every exported zod model so the generator names it as a component. Runs as an oxlint JS plugin and in ESLint 9 and later. Build-time only. | none |

Rule of thumb: if the client and the server must both get it right, it belongs in protocol. If it describes what a route is, it belongs in core. Bindings adapt both to one transport and own nothing the other side needs.

Internal dependencies are published as caret ranges (`workspace:^`). Errors that cross module copies (`ValidationError`, `VersionResolutionError`, `RouteSetupError`, `SupertestTargetError`) are branded with `Symbol.for` and expose a static `is…` guard.

## Server dispatch

Each `.handle()` registers its own express route, on the router it was called on, under the path of its version. Express therefore fills `req.params` with that version's param names, and router-level middleware applies in registration order, exactly as the typed `use()` chain claims.

The application owns one version registry, shared with every branch and mounted router module. It records which versions are handled per method and path shape. On a request, the first matching route resolves the requested version against that registry (once per request, cached) using the router's version policy:

- unversioned: run;
- resolved to this route's version: run the route middlewares, validate the whole request, call the handler;
- resolved to another version: `next()`, so express reaches the route of that version, which may be registered later or on a branch;
- missing or incompatible: `VersionResolutionError` (400) to `next(err)`.

If the resolved version is handled on a router the request never reaches, express answers 404. Handling the same route version twice throws a `RouteSetupError` at setup.

## Calling side

`RESTClient` and `SupertestAdapter` both plan a request with protocol's `planRequest` (url from path params and query, body only for methods that send one) and then hand it to their transport. Two differences are intentional: the client applies its `VersionInjector.modifyUrl` to the built url, the supertest adapter to the path template; and supertest merges default headers below call headers below the injector's.

A route declared with `.multipart()` takes `multipart/form-data`: `RouteDef.bodyEncoding` is `'multipart'`, and the OpenAPI generator emits that media type. `.multipart({ json: true })` keeps accepting JSON as well (`'json-or-multipart'`): the request input is the union of both shapes and OpenAPI lists both media types. The validator only sees what the upload middleware made of the files, so their field names are declared with `.multipart({ files: { avatar: { required: true } } })` to document them as binary parts. Express-server does not enforce the encoding, parsing stays with a route middleware such as multer, so the validator keeps describing the parsed request.

Because that is not what a caller sends, `RouteRequestInput` replaces `body`, `file` and `files` of such routes with the wire format of a binding:

- The client takes `body: FormData`, the global one of Node 18+ with `Blob`/`File` parts. It passes the body to its `HTTPAdapter` unserialized, together with the resolved `bodyEncoding` (`'multipart'` or `'json'`), so a custom adapter must not JSON-serialize a multipart body. On a route taking either encoding the body decides, recognized by `instanceof FormData` or its `FormData` tag (npm `form-data`, jsdom). `AxiosHTTPAdapter` (from `@t-rest/client/axios`) needs axios 1.3 or later for native `FormData`.
- The supertest adapter takes `multipart: { fields, files }` and encodes the form itself. Array and object fields are flattened into the bracketed names multer parses back (`tags[0]`, `meta[label]`), values with `toJSON` are sent as what it returns, `null` as an empty field. Empty arrays and objects have no wire representation and are left out, so a required array field needs at least one element, and objects whose keys are all indices are rejected because multer parses them back as arrays. Every other value arrives as text, so `fields` only takes a number, boolean or date where the validator also accepts its text, e.g. `z.coerce.number()`. A route whose validator requires `file` requires a file. A request without parts still sends an empty multipart body, and a `Content-Type` passed with the call replaces the generated one.

`adapter.invalid.<method>` is the supertest adapter's escape hatch for testing validation failures: it takes the same path and version and returns the same response type as the regular handler, but leaves `params`, `query` and `body` unknown, and takes an untyped `multipart` form instead of a `body` to send invalid form fields or files (not on GET and DELETE). `adapter.untyped.<method>` is the same handler for valid requests the validator does not describe, e.g. when a middleware reshapes the body before validation.

The version header convention can be declared once with `versionHeader('x-api-version')` and turned into each side's adapter with `versionExtractorFrom` (server) and `versionInjectorFrom` (client, supertest).

## OpenAPI generation

`buildOpenAPI` in `@t-rest/open-api-generator` runs one pipeline. Each stage has its own directory under `packages/open-api-generator/src`, and `build/` wires them together.

1. **Reader** (`reader/`). It converts each schema with `~standard.jsonSchema`, `input` for request validators and `output` for responses, in JSON Schema 2020-12. It normalizes what libraries emit (safe-integer bounds, the strictness of output objects, `readOnly` in requests) and turns the result into model shapes. A `$defs` entry becomes a named type when the vendor policy trusts its key. Conversions are cached per schema object for one run.
2. **Route stage** (`route/`). It turns every revision of every route into an `Operation`. Parameters and the request body come from the validator slots, responses from the descriptors, and security, examples, `operationId` and meta from the route. The result is the model of the whole bag, `ApiModel<DefKey>`, whose types are keyed by direction and id (`input:Product`, `output:Product`).
3. **Naming** (`naming/`). It runs once over the whole-bag model. It merges the input and output of an id when they are equal, gives the input of the others the input suffix, writes aliases, asks `nameAnonymous`, and resolves conflicts. The result is `ApiModel<ComponentName>`.
4. **Selection** (`spec/`). For each spec, it runs the `filter` on every revision, resolves the spec version the way the server does (`resolveDateVersion` for date versioning, `resolveVersion` for semver), and prunes types, shared responses and security schemes that no selected operation reaches.
5. **Writer** (`writer/`). It writes one OpenAPI document for a target. The only place where 3.0, 3.1 and 3.2 differ is the `CAPABILITIES` table in `writer/capabilities.ts`, and a lint rule keeps target names out of the other writer files.
6. **Output** (`output/`). It serializes each document as YAML or JSON with its model sidecar and stages every file as a temp file before renaming it.

Every stage reports problems as typed diagnostics from the table in `diagnostics/registry.ts`, and nothing writes to the console. The same table generates `docs/open-api-generator/diagnostics.md`. The capability table generates `targets.md`, and the model's zod schema generates `api-model.md` and the published JSON Schema. Vitest file snapshots keep those files current inside `pnpm test`.

### Who owns what

- The schema library owns the conversion to JSON Schema. The generator never imports zod to read a route schema, and all vendor knowledge sits in the policy table of `reader/vendor-policy.ts`.
- `@t-rest/core` owns what a route says about itself. That is the descriptor docs and ids, `RouteMeta`, security schemes as values, default responses and `defineModels`. Core never emits OpenAPI. Security and examples have no effect on the server or the client.
- The generator owns reading, naming and writing. Only naming creates component names. The writer accepts only `ApiModel<ComponentName>`, so it cannot make a naming decision.

### Why the model is format-neutral

The model describes JSON values on the wire, not OpenAPI. `null` is a member of a union instead of a `nullable` flag, optionality lives on fields and parameters, enums keep their member names, and named types are references by id, so recursion needs no depth limit. Nothing in it knows `components`, `$ref` strings or parameter styles.

That buys two things. One model writes all three targets, and the 3.0 approximations happen only at the edge, where each is reported as `writer/downgrade`. And the model is a stable, versioned JSON format of its own. Each spec's sidecar is the input for comparing two API versions without parsing OpenAPI.

### How versions and filters become several specs

The bag is read and named once, over every revision of every route, so every spec of one `buildOpenAPI` call uses the same component names. A spec then selects from that model. Its filter sees each revision with its typed meta before the version is resolved, and pruning keeps only what the selected operations reach. A public spec and an internal spec of one bag therefore agree on every name, and each one documents only what it exposes. The cost is that naming sees the whole bag. When only an internal route returns a schema that reads differently as input, the public spec still names its input `XInput`.

## Guardrails

- `pnpm api:check` compares each published package's emitted `.d.ts` with the snapshot in `packages/<pkg>/api/`. A diff means a public API change: run `pnpm api:update` and describe it in a changeset (`major` with migration notes if it breaks consumers).
- `pnpm check:packages` runs the dependency check, publint and attw on the built packages.
- CI runs build, type check and tests against Express 4 and 5.
