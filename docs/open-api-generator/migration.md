# Migrating from the TypeScript-type generator

`@t-rest/open-api-generator` used to read route types through a TypeScript program. `buildOpenAPI` now reads the routes' schemas through Standard JSON Schema, names components by schema ids, and writes OpenAPI 3.0, 3.1 or 3.2. This guide lists what to change in your generator script, your models and your routes, and which differences to expect in the documents.

## Replace the generator call

`OpenAPIGenerator.generate` becomes one `buildOpenAPI` call with one entry in `specs` per document.

<!-- removed API, not compiled -->
```ts
await OpenAPIGenerator.generate([
  {
    spec: OpenAPISpec.ofVersion(bag, '2025-01-01').withMetaData(
      {
        title: 'Shop API',
        description: 'The shop',
        headers: [{ name: 'x-client-id', required: true, type: StringType() }],
      },
      {
        includeTypesNamespaceInName: true,
        canonicalTypeOwnership: {
          namespacePattern: /^(?<version>V\d{4}_\d{2}_\d{2})\.(?<audience>Customer|Admin|Shared)(\.|$)/,
          sharedAudience: 'Shared',
        },
      }
    ),
    outputDir: 'docs',
    outputFile: 'openapi.yaml',
    entry: './src/bag.ts',
    tsConfigPath: './tsconfig.json',
    filter: ({ path }) => !path.startsWith('/admin'),
  },
])
```

<!-- example: migration/after-generator.ts -->
```ts
import {
  BagOfRoutes,
  securityScheme,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'
import { getAddress, getCustomerAddress } from './after-routes.js'

export const bag = BagOfRoutes.withVersioning(
  Versioning.DATE,
  VersionHistory(['2024-01-01', '2025-01-01'] as const)
)
  .addRoute(getAddress)
  .addRoute(getCustomerAddress)
  .build()

const bearer = securityScheme('bearer', { type: 'http', scheme: 'bearer' })

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API', description: 'The shop' },
  headers: z.object({ 'x-client-id': z.string() }),
  securityFromHeaders: { authorization: bearer },
  specs: [
    {
      version: '2025-01-01',
      target: '3.0',
      output: 'docs/openapi.yaml',
      filter: (route) => !route.path.startsWith('/admin'),
    },
  ],
})
```

Then call `await build.write()`. The old options map to the new config like this:

| Before | After |
| --- | --- |
| `OpenAPISpec.ofVersion(bag, version)` | `bag`, and `version` of a spec. `versions: 'all'` writes one spec per version. |
| `withMetaData({ title, description })` | `info` |
| `withMetaData({ headers })`, written with `StringType()` and the other type constructors | `headers`, one object schema. Route headers come from the validator's `headers` key and win over global headers. |
| `outputDir` and `outputFile` | `output`. Its extension (`.yaml`, `.yml` or `.json`) picks the format. |
| `entry` and `tsConfigPath` | Removed. No TypeScript program runs. |
| `filter: ({ metaData }) => ...` | `filter: (route) => ...` with `route.meta`, typed from the bag's routes. |
| OpenAPI 3.0 only | `target`, required. `'3.0'` keeps the previous format. |
| `includeTypesNamespaceInName`, `canonicalTypeOwnership` | Removed. Set ids with `.meta({ id })` or `defineModels`, see below. |
| `deriveRouteNamingContext` | Removed. `naming.nameAnonymous` names inline body objects from the route. |

The package exports only `buildOpenAPI`, `parseApiModel`, `apiModelJsonSchema`, `OpenAPIGenerationError` and their types. `OpenAPIGenerator`, `OpenAPISpec`, the type constructors, `validateRouteMeta`, `Header`, `OpenAPIMetaData` and `OpenAPIGeneratorOptions` are removed. The `typescript` peer dependency is removed, and `zod` 4.5 or later is a peer dependency.

Problems are diagnostics on the build instead of console warnings. `write()` rejects with `OpenAPIGenerationError` and writes nothing when one of them is an error. [Diagnostics](diagnostics.md) lists every code.

## Turn TypeScript models into schemas with ids

The old generator named a type after the TypeScript namespace it was exported from. A type that several versioned namespaces re-exported needed `includeTypesNamespaceInName` and `canonicalTypeOwnership` to pick one owner.

<!-- example: migration/before-routes.ts -->
```ts
import { json, Route } from '@t-rest/core'

export namespace V2024_01_01.Shared {
  export interface Address {
    street: string
    city: string
  }
}

// 2025-01-01 re-exports the 2024 address for customers and admins
export namespace V2025_01_01.Customer {
  export type Address = V2024_01_01.Shared.Address
}
export namespace V2025_01_01.Admin {
  export type Address = V2024_01_01.Shared.Address
}

export const getAddress = Route.version('2025-01-01')
  .get('/me/address')
  .responses({ 200: json<V2025_01_01.Customer.Address>() })

export const getCustomerAddress = Route.version('2025-01-01')
  .get('/admin/customers/:customerId/address')
  .responses({ 200: json<V2025_01_01.Admin.Address>() })
```

Now a schema carries its id from the place where it is defined. Re-exporting the schema object keeps the id, so every version that re-exports it shares one component. A namespace that wants its own name creates an alias.

<!-- example: migration/after-models.ts -->
```ts
import { defineModels } from '@t-rest/core/zod'
import { z } from 'zod'

// the id is set once, where the schema is defined: V2024_01_01_Shared_Address
export const V2024_01_01_Shared = defineModels('V2024_01_01.Shared', {
  Address: z.object({ street: z.string(), city: z.string() }),
})

// a re-export is the same schema object, so it keeps the id
export const V2025_01_01_Customer = {
  Address: V2024_01_01_Shared.Address,
}

// an alias: V2025_01_01_Admin_Address, a component that refers to the shared one
export const V2025_01_01_Admin = defineModels('V2025_01_01.Admin', {
  Address: V2024_01_01_Shared.Address,
})
```

<!-- example: migration/after-routes.ts -->
```ts
import { json, Route } from '@t-rest/core'
import { V2025_01_01_Admin, V2025_01_01_Customer } from './after-models.js'

export const getAddress = Route.version('2025-01-01')
  .get('/me/address')
  .responses({ 200: json(V2025_01_01_Customer.Address) })

export const getCustomerAddress = Route.version('2025-01-01')
  .get('/admin/customers/:customerId/address')
  .responses({ 200: json(V2025_01_01_Admin.Address) })
```

`GET /me/address` refers to `V2024_01_01_Shared_Address`, the id from the definition site, in every version that uses it. The admin route refers to the alias, which is a component that only refers to the shared one:

```yaml
V2024_01_01_Shared_Address:
  type: object
  properties:
    street:
      type: string
    city:
      type: string
  required:
    - street
    - city
V2025_01_01_Admin_Address:
  $ref: "#/components/schemas/V2024_01_01_Shared_Address"
```

`naming.aliases: 'materialize'` writes the alias as a copy instead. [Naming components](naming-components.md) covers `defineModels`, aliases and the lint rule that reports exported models without an id.

## Give `json<T>()` a schema

A response typed only by a type argument has no shape the generator can read. It is documented as any JSON value with [`response/untyped-json`](diagnostics.md#responseuntyped-json). Pass the schema instead, and the body type follows from it.

<!-- example: migration/json-schema.ts -->
```ts
import { json, Route } from '@t-rest/core'
import { z } from 'zod'

const Product = z
  .object({ id: z.number(), name: z.string() })
  .meta({ id: 'Product' })

type ProductBody = { id: number; name: string }

// before: documented as any JSON value, with response/untyped-json
export const before = Route.get('/products').responses({
  200: json<ProductBody[]>(),
})

// after: typed and documented by the schema
export const after = Route.get('/products').responses({
  200: json(z.array(Product)),
})
```

`json<T>(schema)` does not compile, so the body type cannot disagree with the schema. Models that you already wrote as zod schemas with `z.infer` usually only need an id.

## Move security to schemes

Declare schemes with `securityScheme()` and reference them in `meta.security`, or set `config.security` for the bag. Until the routes are moved, `securityFromHeaders: { authorization: bearer }` documents routes that declare an `authorization` header as the scheme and removes the header parameter. [Security](security.md) shows each step.

## Move examples

Request examples go on the validator, `.validate(schema, { examples })`, and response examples on the descriptor, `json(schema, { examples })`. Both are typed against their schema and validated during generation. Route meta has no `examples` key, because `.metaData()` can run before the route's schemas exist, so it cannot type examples against them. See [Documenting routes](documenting-routes.md).

## Check route meta against `RouteMeta`

`RouteMeta` moved to `@t-rest/core`. `.metaData()` checks the keys `RouteMeta` declares and keeps every other key with its own type.

<!-- example: migration/meta-typing.ts -->
```ts
import { Route } from '@t-rest/core'

// RouteMeta keys are checked, other keys keep their own type
export const route = Route.get('/products')
  .metaData({ summary: 'List products', public: true })
  .response(204)

export const meta: { summary: string; public: boolean } = route.metaData
```

A `RouteMeta` key with a value of the wrong type, such as `tags: 'orders'`, no longer compiles. `RouteMeta` has no `headers` key anymore, so a `headers` key in meta is an ordinary custom key. Declare headers in the validator. Keys outside `RouteMeta` are no longer stripped. The spec `filter` sees them, and keys that start with `x-` become operation extensions.

## Expect these changes in the documents

The first regeneration changes the documents once:

- Component names follow schema ids instead of TypeScript type names.
- A schema with an id that reads differently as request and as response, for example because of a `.default()`, becomes two components, `X` and `XInput`. Names are computed over the whole bag, so a filtered public spec can show `XInput` without `X` when only an internal route returns `X`.
- 3.0 documents declare `openapi: 3.0.3`.
- Response descriptions fall back to the reason phrase, such as `OK` or `Not Found`, instead of `Successful response` and `Error response`.
- With `securityFromHeaders`, `authorization` header parameters become operation security.
- Constraints, formats, descriptions, defaults and examples from the schemas appear in the documents.
- Empty `servers`, `tags` and `parameters` are left out.
- A union of components with a shared literal property gets a `discriminator`.
- Each spec gets an `api-model.json` sidecar.

[`naming/probable-model-without-id`](diagnostics.md#namingprobable-model-without-id) reports inline objects that repeat across operations. It is a warning, not an error, so existing bags still generate. Raise it in `config.diagnostics` once your models have ids.

## Review the changes in `@t-rest/core`

- A default response documents a status but does not send it. `bag.withDefaultResponses({ 400: json(Problem) })` types and documents the `400` body. When validation fails, `@t-rest/express-server` passes a `ValidationError` to `next(err)`, and your error handler must send that body.
- `emptyValidation`, the validator of a route without `.validate()`, implements Standard JSON Schema. Its `~standard.vendor` changed from `'valizod'` to `'t-rest'`.
- The `zod` peer range of `@t-rest/core` is `^4.5.0`.
