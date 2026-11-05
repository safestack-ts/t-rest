# Naming components

`@t-rest/open-api-generator` turns a schema into a component when the schema carries an id. The id is the component name, and every use of the schema becomes a `$ref` to it. A schema without an id is written inline wherever a route uses it.

This guide shows how to set ids, which schemas stay inline, how aliases are written, how to name schemas that factories create, why one id can become two components, and how to catch a missing id in the editor.

## Set the id where the schema is defined

Give a zod schema an id with `.meta({ id })` in the module that defines it.

<!-- example: naming-components/ids.ts -->
```ts
import { z } from 'zod'

export const Customer = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'Shop_Customer' })

export const Order = z
  .object({ id: z.uuid(), customer: Customer, total: z.number() })
  .meta({ id: 'Shop_Order' })
```

Both schemas become components, `Shop_Customer` and `Shop_Order`, and `Shop_Order.customer` is a `$ref` to `Shop_Customer`. The id belongs to the schema object. When another namespace or a later version re-exports `Customer`, it re-exports the same object, so every route that uses it refers to one `Shop_Customer` component. The generator does not look at TypeScript namespaces or export paths.

Each id names exactly one schema. Two different schemas with one id fail generation with [`naming/duplicate-id`](diagnostics.md#namingduplicate-id). A component name keeps letters, digits, `.`, `_` and `-`, and the generator replaces every other character with `_`. If two ids become the same name that way, the later one gets a numeric suffix and [`naming/component-conflict`](diagnostics.md#namingcomponent-conflict) fails generation.

## Derive ids from a namespace with `defineModels`

`defineModels(namespace, models)` from `@t-rest/core/zod` gives every schema of `models` the id `<namespace>_<key>`. The dots of the namespace become underscores.

<!-- example: naming-components/define-models.ts -->
```ts
import { defineModels } from '@t-rest/core/zod'
import { z } from 'zod'

// ids V2024_01_01_Shared_Address and V2024_01_01_Shared_Contact
export const { Address, Contact } = defineModels('V2024_01_01.Shared', {
  Address: z.object({ street: z.string(), city: z.string() }),
  Contact: z.object({ email: z.email(), phone: z.string().optional() }),
})
```

`defineModels` returns the same keys with the same schema types. It throws when an id holds anything other than letters, digits and underscores, and it registers no model of that call.

A schema without an id is registered in place, in zod's global registry. Schemas that nest it, also ones defined before the `defineModels` call, refer to it by the new id, and metadata such as a `description` stays. A schema that already has an id gets a copy with the new id instead, which is an [alias](#choose-how-aliases-are-written).

Pass each schema to `defineModels` once and use the schema it returns. A second `defineModels` call over the same object creates an alias, and evaluation order decides which call owns the base id.

## Know what is inlined

A schema without an id is inlined at each use, because the generator has no stable name for it. Keys that a library generates itself, such as zod's `__schema0`, are not ids, so the generator never uses them as names.

zod does not carry an id over to a schema derived from it. `.extend()`, `.pick()`, `.omit()`, `.partial()`, `.required()` and `.merge()` return a new schema without an id, so give the result its own id.

<!-- example: naming-components/derived.ts -->
```ts
import { z } from 'zod'
import { Customer } from './ids.js'

// no id: zod does not carry the id of Customer over, so this is inlined
export const CustomerWithNotes = Customer.extend({ notes: z.string() })

// its own id: a component of its own
export const CustomerDetails = Customer.extend({ notes: z.string() }).meta({
  id: 'Shop_CustomerDetails',
})
```

Two diagnostics point at schemas that should probably have an id:

- [`naming/probable-model-without-id`](diagnostics.md#namingprobable-model-without-id) (warning) reports an inline object with at least two fields that appears in the request or response bodies of two or more operations.
- [`naming/model-without-id`](diagnostics.md#namingmodel-without-id) (error) reports every schema of `naming.models` that has no id, so the run fails until each model is named. Pass the module that exports your models.

<!-- example: naming-components/models-check.ts -->
```ts
import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import * as Models from './derived.js'

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/customers/:customerId').responses({
      200: json(Models.CustomerDetails),
    })
  )
  .build()

// naming/model-without-id for CustomerWithNotes
export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  naming: { models: Models },
  specs: [{ target: '3.1', output: 'openapi/shop.yaml' }],
})
```

A recursive schema without an id cannot be inlined, so it gets a fallback name built from the operationId, the slot and the JSON pointer, with [`naming/anonymous-recursion`](diagnostics.md#naminganonymous-recursion). The fallback changes when the route changes, so give recursive schemas an id.

## Choose how aliases are written

An alias is a schema with an id that is a copy of a schema with another id. zod writes it as a definition that only refers to the original. You create one with `.meta({ id })` on a schema that already has an id, or with `defineModels` over such a schema.

<!-- example: naming-components/aliases.ts -->
```ts
import { BagOfRoutes, json, Route } from '@t-rest/core'
import { defineModels } from '@t-rest/core/zod'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { Customer, Order } from './ids.js'

// Customer and Order already have ids, so these are aliases of them
export const Admin = defineModels('Admin', { Customer, Order })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/admin/orders/:orderId').responses({ 200: json(Admin.Order) })
  )
  .addRoute(
    Route.get('/admin/customers/:customerId').responses({
      200: json(Admin.Customer),
    })
  )
  .build()

export const referenced = buildOpenAPI({
  bag,
  info: { title: 'Admin API' },
  specs: [{ target: '3.1', output: 'openapi/admin.yaml' }],
})

export const materialized = buildOpenAPI({
  bag,
  info: { title: 'Admin API' },
  naming: { aliases: 'materialize' },
  specs: [{ target: '3.1', output: 'openapi/admin.yaml' }],
})
```

By default (`naming.aliases: 'reference'`), an alias is a component that only refers to its target, and the target is emitted too. This matches what the validator emits and copies no bodies. `referenced` writes these schemas:

```yaml
Admin_Customer:
  $ref: "#/components/schemas/Shop_Customer"
Admin_Order:
  $ref: "#/components/schemas/Shop_Order"
```

With `naming.aliases: 'materialize'`, each alias is a copy of its target's body. A spec then shows only the alias names of its audience, at the cost of duplicated bodies and a separate client type per alias. The target is emitted only when something else refers to it.

Aliasing is shallow in both modes. `Admin_Order.customer` still refers to `Shop_Customer`, so `materialized` emits `Admin_Customer`, `Admin_Order` and `Shop_Customer`. If the admin spec must not show `Shop_` names, build the admin order from `Admin.Customer` and give it its own id.

Aliases never collapse into their target. Re-exporting the same object already gives one name, so an alias always means that its author wants a second name.

## Name schemas that factories create

A factory such as a pagination wrapper creates a new schema per call, without an id. `naming.nameAnonymous` names these schemas from the route context.

<!-- example: naming-components/name-anonymous.ts -->
```ts
import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'
import { Customer, Order } from './ids.js'

const page = <TItem extends z.ZodType>(item: TItem) =>
  z.object({ items: z.array(item), total: z.int().min(0) })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/orders').responses({ 200: json(page(Order)) }))
  .addRoute(Route.get('/customers').responses({ 200: json(page(Customer)) }))
  .build()

const pageNames: Record<string, string> = {
  '/orders': 'Shop_OrderPage',
  '/customers': 'Shop_CustomerPage',
}

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  naming: {
    nameAnonymous: (context) =>
      context.kind === 'slot' && context.slot === 'response 200'
        ? pageNames[context.operation.path]
        : undefined,
  },
  specs: [{ target: '3.1', output: 'openapi/shop.yaml' }],
})
```

The hook receives an `AnonymousContext` and returns a name, or `undefined` to keep the schema inline. It is asked about two kinds of schema:

- `kind: 'slot'` is an inline object at the root of a request body (`slot: 'body'`) or a response body (`slot: 'response 200'`). The context has the `operation` (with `method`, `path`, `version` and `operationId`), the `contentType` and the `shape`. An array body such as `z.array(page(Order))` is not an object, so the hook is not asked about it.
- `kind: 'recursive'` is a recursive schema without an id. The context has the `scope` (an operation slot or the id of the enclosing named type), the JSON `pointer` and the `shape`.

Bodies that get one name share one component when their shapes are equal. One name for different shapes is [`naming/component-conflict`](diagnostics.md#namingcomponent-conflict).

## Expect a second component for input that differs from output

The generator reads a request schema as input and a response schema as output. A schema with an id can differ between the two. `.default()` makes a field optional in the input and required in the output, and `.transform()` and `.readonly()` change it too. Such a schema becomes two components. The output keeps the id, and the input gets the id plus `naming.inputSuffix` (default `Input`). Each split is reported as [`naming/direction-split`](diagnostics.md#namingdirection-split) (info).

<!-- example: naming-components/direction-split.ts -->
```ts
import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'

const Settings = z
  .object({ theme: z.enum(['light', 'dark']).default('light') })
  .meta({ id: 'Settings' })

const Profile = z
  .object({ name: z.string(), settings: Settings })
  .meta({ id: 'Profile' })

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.put('/me')
      .validate(z.object({ body: Profile }))
      .responses({ 200: json(Profile) })
  )
  .build()

// components Profile, ProfileWrite, Settings and SettingsWrite
export const build = buildOpenAPI({
  bag,
  info: { title: 'Profile API' },
  naming: { inputSuffix: 'Write' },
  specs: [{ target: '3.1', output: 'openapi/profile.yaml' }],
})
```

`PUT /me` takes a `ProfileWrite` and returns a `Profile`. `Settings` splits because of its default, and `Profile` splits because its input refers to `SettingsWrite`. A split nested schema splits every schema above it.

```yaml
Settings:
  type: object
  properties:
    theme:
      type: string
      enum:
        - light
        - dark
      default: light
  required:
    - theme
SettingsWrite:
  type: object
  properties:
    theme:
      type: string
      enum:
        - light
        - dark
      default: light
```

Names are computed once over the whole bag, so specs filtered from one bag use the same names. A filtered spec can therefore show `SettingsInput` without `Settings`. This happens when only an internal route returns `Settings`, because the public spec only sends it and still gets the input name. To keep one component, use the schema in one direction only, or move the default out of the shared schema.

## Report missing ids in the editor

The `t-rest/require-model-id` rule of [`@t-rest/oxlint-plugin`](../../packages/oxlint-plugin/README.md) reports exported zod schemas without an id, derived schemas without their own id, and, with `idFromPath`, ids that do not match the file path. It runs as an oxlint JS plugin and in ESLint 9 and later. To scope it to your models directory with oxlint, add an override:

```json
{
  "overrides": [
    {
      "files": ["src/models/**"],
      "jsPlugins": ["@t-rest/oxlint-plugin"],
      "rules": {
        "t-rest/require-model-id": [
          "error",
          { "idFromPath": { "root": "src/models" } }
        ]
      }
    }
  ]
}
```

The plugin README covers the ESLint setup, the options and every reported mistake. The rule does not detect a schema passed to `defineModels` twice.
