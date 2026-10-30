# @t-rest/open-api-generator

Generates OpenAPI 3.0 specs from a t-rest bag of routes. Input and response schemas are derived from the TypeScript types of the routes, so the entry module has to default export the bag of routes.

```ts
import path from 'path'
import {
  OpenAPIGenerator,
  OpenAPISpec,
  StringType,
} from '@t-rest/open-api-generator'
import bagOfRoutes from './bag-of-routes.js'

const spec = OpenAPISpec.ofVersion(bagOfRoutes, '2024-01-01').withMetaData(
  {
    title: 'My API',
    description: 'My API description',
    headers: [{ name: 'x-client-id', required: true, type: StringType() }],
  },
  { includeTypesNamespaceInName: true }
)

await OpenAPIGenerator.generate([
  {
    spec,
    outputFile: 'openapi.yaml',
    outputDir: 'docs',
    entry: './src/bag-of-routes.ts',
    tsConfigPath: path.join(import.meta.dirname, '../tsconfig.json'),
    // optional, e.g. to generate a public spec from route meta data
    filter: ({ method, path, version, metaData }) => true,
    // optional, overrides the options passed to `withMetaData`
    options: {},
  },
])
```

## Options

Options can be passed to `withMetaData` and per spec to `OpenAPIGenerator.generate`, where the latter take precedence.

| Option                        | Default     | Description                                                                                                                                                                                         |
| ----------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `includeTypesNamespaceInName` | `false`     | Prefixes component names with the namespace path a type is exported from, e.g. `V2024_01_01_Customer_Checkout_Checkout` for `V2024_01_01.Customer.Checkout.Checkout`.                               |
| `canonicalTypeOwnership`      | `undefined` | Names types re-exported by several public namespaces after a single canonical owner, see [Canonical type ownership](#canonical-type-ownership). Requires `includeTypesNamespaceInName`.             |
| `deriveRouteNamingContext`    | `undefined` | `(route) => string \| undefined`, the naming context (a namespace path) of a route input or response whose route definition does not reference a namespaced type, e.g. derived from the route path. |

### Naming context

With `includeTypesNamespaceInName`, the namespace of types that are re-exported by several namespaces (e.g. a shared `Checkout` type re-exported by `V2024_01_01.Customer.Checkout` and `V2024_01_01.Admin.Checkout`) is selected by the naming context of the route: the namespace of the type written in `.response<...>()` or within `.validate(...)`. Routes without such a type, e.g. a validator built from imported zod schemas, use `deriveRouteNamingContext`:

```ts
deriveRouteNamingContext: ({ method, path, version, kind, namingContext }) =>
  // `kind` is 'input' or 'response', `namingContext` holds the contexts found in the route definition
  namingContext.response ??
  (path.includes('/admin/')
    ? `V${version.replace(/-/g, '_')}.Admin`
    : undefined)
```

### Canonical type ownership

Versioned APIs often re-export the types of earlier versions or shared modules from several public namespaces. `canonicalTypeOwnership` names such a type after exactly one owner, so the same type does not end up as several components:

```ts
canonicalTypeOwnership: {
  namespacePattern: /^(?<version>V\d{4}_\d{2}_\d{2})\.(?<audience>Admin|Customer|Shared)(\.|$)/,
  sharedAudience: 'Shared',
  inheritRouteNamespaceForUnownedTypes: true,
  routeScopedTypeModules: /[\\/]utils[\\/]pagination\.ts$/,
}
```

| Option                                 | Default     | Description                                                                                                                                                                                                                                                                |
| -------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `namespacePattern`                     | (required)  | Matches the public namespace paths that may own types. The named groups `version` and `audience` identify the version and audience of a namespace. Other namespace paths a type is exported from are ignored, only TypeScript `namespace` declarations remain as fallback. |
| `sharedAudience`                       | `undefined` | Audience whose re-exports are used when the audience of the naming context does not re-export a type.                                                                                                                                                                      |
| `inheritRouteNamespaceForUnownedTypes` | `false`     | Names named types without a public owner (e.g. non-exported interfaces) after the namespace of the route or enclosing type that uses them. Throws if the same type would be named after several namespaces of the same version.                                            |
| `routeScopedTypeModules`               | `undefined` | Matches the file names of modules whose types are always named after the namespace of the route that uses them, e.g. generic query helpers shared by many routes. They are emitted once per route namespace, and unnamespaced for routes without a naming context.         |

The canonical owner of a type is a re-export of the audience of the naming context, or of the shared audience, within the earliest version (versions are compared lexicographically). If several namespaces of that version re-export the type, the one exporting it under its original name wins, otherwise generation fails with `Ambiguous canonical public type ownership`. Types without a public re-export keep the public namespace they are declared or exported in. Within a type, nested types are resolved in the context of its namespace.
