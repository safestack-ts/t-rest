# @t-rest/open-api-generator

Generates OpenAPI 3.0, 3.1 and 3.2 documents from a t-rest bag of routes. The generator reads the schemas of the routes' validators and response descriptors through [Standard JSON Schema](https://standardschema.dev), so zod 4.5 or later documents itself and no TypeScript program runs. Next to each document it writes an `api-model.json` sidecar, a format-neutral model of the same API for tools such as breaking-change checks.

## Generate a document

Install the generator next to `@t-rest/core` and zod:

```sh
pnpm add -D @t-rest/open-api-generator
```

Take a bag whose routes use schemas:

<!-- example: readme/bag.ts -->
```ts
import { BagOfRoutes, json, Route } from '@t-rest/core'
import { z } from 'zod'

const Product = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'Product' })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/products')
      .metaData({ public: true })
      .responses({ 200: json(z.array(Product)) })
  )
  .addRoute(
    Route.delete('/products/:productId')
      .metaData({ public: false })
      .response(204)
  )
  .build()
```

Build the specs and write them:

<!-- example: readme/quick-start.ts -->
```ts
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag } from './bag.js'

const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API', description: 'Products and orders' },
  specs: [{ target: '3.1', output: 'openapi/openapi.yaml' }],
})

for (const { severity, code, message } of build.diagnostics) {
  console.log(`${severity} ${code}: ${message}`)
}

// openapi/openapi.yaml and openapi/openapi.api-model.json
await build.write()
```

`buildOpenAPI` does not touch the file system. It returns the named model of the whole bag (`model`), every spec with its `document` and `model` (`specs`), and every problem it found (`diagnostics`). `write()` writes each spec to its `output`, relative to the working directory, and writes a `<basename>.api-model.json` sidecar next to it. The sidecar holds the model of that spec only.

## Configuration reference

`buildOpenAPI(config)` takes these keys:

| Key | Description |
| --- | --- |
| `bag` | The built bag of routes. |
| `info` | `title`, `description`, `contact`, `license` and `version` of the document. `version` defaults to the spec version, and to `1.0.0` for an unversioned bag. |
| `servers` | Servers of every document. |
| `tags` | Declared tags with descriptions, in this order. Tags that only routes use follow them. |
| `security` | Security of routes without `meta.security`, see [Security](../../docs/open-api-generator/security.md). |
| `securitySchemes` | Schemes every spec documents, also when no route of the spec uses them. |
| `securityFromHeaders` | Header name to scheme. A route that declares the header gets the scheme. |
| `headers` | Header parameters of every operation, one object schema. Route headers win. |
| `operationId` | `(route) => string \| undefined`, used when `meta.operationId` is absent. |
| `naming.aliases` | `'reference'` (default) or `'materialize'`, see [Naming components](../../docs/open-api-generator/naming-components.md). |
| `naming.inputSuffix` | Appended to the id of an input that differs from its output. Default `Input`. |
| `naming.nameAnonymous` | Names inline body objects and recursive schemas without an id. |
| `naming.models` | A models module, `import * as Models`. Every schema in it without an id is reported. |
| `vendors.trust` | Vendors whose `$defs` keys are ids, see [Validator support](../../docs/open-api-generator/validator-support.md). |
| `diagnostics` | Severity overrides for configurable diagnostic codes, such as `{ 'writer/downgrade': 'info' }`. |
| `specs` | The documents to build. |

Each entry of `specs` takes these keys:

| Key | Description |
| --- | --- |
| `target` | `'3.0'`, `'3.1'` or `'3.2'`. |
| `output` | The file path. The extension picks the format. `{version}` is replaced with the spec version. |
| `version` | The version to document. Defaults to the newest version of a versioned bag. |
| `versions` | `'all'` or a list of versions, for one spec per version. `output` must contain `{version}`. |
| `filter` | `(route) => boolean`. Routes for which it returns `false` are left out. |

## Choose a target

One writer writes every target from the same model. The targets differ only in how they encode some schemas, which [OpenAPI targets](../../docs/open-api-generator/targets.md) lists.

- `'3.0'` (`openapi: 3.0.3`) is read by the most tools. It cannot express every schema, so the writer approximates tuples of mixed types, several schema examples, constrained `propertyNames` and non-`x-` annotations, and reports each approximation as [`writer/downgrade`](../../docs/open-api-generator/diagnostics.md#writerdowngrade).
- `'3.1'` (`openapi: 3.1.1`) uses JSON Schema 2020-12 and writes these schemas without approximations.
- `'3.2'` (`openapi: 3.2.0`) uses the same schema encoding as 3.1.

Use the newest target that the tools reading your documents support. The generator's tests validate the documents of every target against the official OpenAPI meta-schemas.

## Write one spec per version

A spec documents one version of a versioned bag. For each route, it documents the newest revision that is not newer than the spec version.

<!-- example: readme/versions.ts -->
```ts
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

export const bag = BagOfRoutes.withVersioning(
  Versioning.DATE,
  VersionHistory(['2024-01-01', '2025-01-01'] as const)
)
  .addRoute(Route.version('2024-01-01').get('/products').response(204))
  .addRoute(Route.version('2025-01-01').get('/orders').response(204))
  .build()

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  specs: [
    // openapi/2024-01-01.json and openapi/2025-01-01.json
    { versions: 'all', target: '3.0', output: 'openapi/{version}.json' },
    // the newest version, 2025-01-01
    { target: '3.1', output: 'openapi/latest.yaml' },
  ],
})
```

## Filter specs

`filter` receives each route revision with its `method`, `path`, `version` and `meta`, before the version is resolved. Use it to build an internal and a public document from one bag.

<!-- example: readme/filter.ts -->
```ts
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag } from './bag.js'

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  specs: [
    { target: '3.1', output: 'openapi/internal.yaml' },
    {
      target: '3.1',
      output: 'openapi/public.yaml',
      filter: (route) => route.meta.public === true,
    },
  ],
})
```

`route.meta` holds what the route passed to `.metaData()`, typed from every route of the bag, so `route.meta.public` is `boolean | undefined`. Component names are computed once for the whole bag, so both specs use the same names. Each spec contains only the components, shared responses and security schemes that its operations reach.

## Write YAML or JSON

The extension of `output` picks the format. `.yaml` and `.yml` write YAML, and `.json` writes JSON. Any other extension fails generation with [`config/output-template`](../../docs/open-api-generator/diagnostics.md#configoutput-template). Key order is deterministic, so a regenerated document changes only where the API changed.

`write()` writes each file to a temp file in its target directory and renames it, so no file is ever half written. The set of files is not written atomically. A sidecar is always JSON, so `openapi/public.yaml` gets `openapi/public.api-model.json`. Two specs that would write one file fail with [`output/path-collision`](../../docs/open-api-generator/diagnostics.md#outputpath-collision).

## Handle diagnostics

Each diagnostic has a `code`, a `severity` (`error`, `warning` or `info`), a location `at` and a `message` that ends with a link to its reference entry. The generator never writes to the console. When any diagnostic is an error, `write()` rejects with `OpenAPIGenerationError`, which carries the `diagnostics`, and writes nothing. Codes marked configurable in the [diagnostics reference](../../docs/open-api-generator/diagnostics.md) accept a severity in `config.diagnostics`.

## Guides

- [Naming components](../../docs/open-api-generator/naming-components.md): ids, `defineModels`, inlining, aliases, the naming hook and input and output splits.
- [Documenting routes](../../docs/open-api-generator/documenting-routes.md): schema metadata, response descriptors, shared error responses, `operationId` and route meta.
- [Security](../../docs/open-api-generator/security.md): schemes, scopes, bag defaults, optional authentication and `securityFromHeaders`.
- [Validator support](../../docs/open-api-generator/validator-support.md): what a schema must provide, the support matrix and known limitations.
- [Migration](../../docs/open-api-generator/migration.md): moving from the TypeScript-type generator.

The runnable example in [`packages/playground/src/openapi`](../playground/src/openapi) builds a versioned bag with models, an alias, security and default error responses into 3.0 and 3.1 documents.

## Reference

- [Diagnostics](../../docs/open-api-generator/diagnostics.md): every code, its severity and its fix.
- [OpenAPI targets](../../docs/open-api-generator/targets.md): how 3.0, 3.1 and 3.2 differ.
- [API model](../../docs/open-api-generator/api-model.md): the format of the `api-model.json` sidecars. `parseApiModel(json)` reads a sidecar, and its JSON Schema is exported as `apiModelJsonSchema` and as `@t-rest/open-api-generator/api-model.schema.json`.
