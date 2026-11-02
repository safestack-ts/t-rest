# Architecture

typed-rest declares a REST contract once and derives the server, the client and the test adapter from it. Types flow from `@t-rest/core`; the runtime rules both ends of the wire must agree on live in `@t-rest/protocol`.

## Packages

| Package | Role | Runtime dependencies |
|---|---|---|
| `@t-rest/protocol` | Wire rules: HTTP methods and which send a body, the `:param` path grammar, path joining, query encoding/decoding, `buildUrl`/`planRequest`, the version header convention. Plain functions and data only. | none |
| `@t-rest/core` | The contract: `Route` builders, `RouteDef`, `BagOfRoutes`, version resolution, `ValidationError`, the type algebra the bindings derive from. `ze` zod helpers on `@t-rest/core/zod` (also re-exported from the root). | protocol, zod (peer) |
| `@t-rest/express-server` | Server binding: typed applications and routers on top of express 4 and 5. | core, protocol, express (peer) |
| `@t-rest/client` | Client binding: `RESTClient` over a pluggable `HTTPAdapter` (axios adapter included). | protocol |
| `@t-rest/supertest-adapter` | Test binding: typed supertest calls against a typed express application. | core, protocol, express-server, supertest |
| `@t-rest/client-utils` | Deprecated, re-exports `buildUrl` from protocol. | protocol |

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

- The client takes `body: FormData`, the global one of Node 18+ with `Blob`/`File` parts. It passes the body to its `HTTPAdapter` unserialized, together with the resolved `bodyEncoding` (`'multipart'` or `'json'`), so a custom adapter must not JSON-serialize a multipart body. On a route taking either encoding the body decides, recognized by `instanceof FormData` or its `FormData` tag (npm `form-data`, jsdom). `AxiosHTTPAdapter` needs axios 1.3 or later for native `FormData`.
- The supertest adapter takes `multipart: { fields, files }` and encodes the form itself. Array and object fields are flattened into the bracketed names multer parses back (`tags[0]`, `meta[label]`), values with `toJSON` are sent as what it returns, `null` as an empty field. Empty arrays and objects have no wire representation and are left out, so a required array field needs at least one element, and objects whose keys are all indices are rejected because multer parses them back as arrays. Every other value arrives as text, so `fields` only takes a number, boolean or date where the validator also accepts its text, e.g. `z.coerce.number()`. A route whose validator requires `file` requires a file. A request without parts still sends an empty multipart body, and a `Content-Type` passed with the call replaces the generated one.

`adapter.invalid.<method>` is the supertest adapter's escape hatch for testing validation failures: it takes the same path and version and returns the same response type as the regular handler, but leaves `params`, `query` and `body` unknown, and takes an untyped `multipart` form instead of a `body` to send invalid form fields or files (not on GET and DELETE). `adapter.untyped.<method>` is the same handler for valid requests the validator does not describe, e.g. when a middleware reshapes the body before validation.

The version header convention can be declared once with `versionHeader('x-api-version')` and turned into each side's adapter with `versionExtractorFrom` (server) and `versionInjectorFrom` (client, supertest).

## Guardrails

- `pnpm api:check` compares each published package's emitted `.d.ts` with the snapshot in `packages/<pkg>/api/`. A diff means a public API change: run `pnpm api:update` and describe it in a changeset (`major` with migration notes if it breaks consumers).
- `pnpm check:packages` runs the dependency check, publint and attw on the built packages.
- CI runs build, type check and tests against Express 4 and 5.
