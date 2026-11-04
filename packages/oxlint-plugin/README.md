# @t-rest/oxlint-plugin

Lint rule for typed-rest APIs that generate OpenAPI documents. `t-rest/require-model-id` makes sure every exported zod model has an id, so the generator can name it as a component instead of inlining it.

The rule is a plain ESLint-format rule (`{ meta, create }`) without runtime dependencies. It runs as an [oxlint JS plugin](https://oxc.rs/docs/guide/usage/linter/js-plugins.html) and in ESLint 9 and later. It is verified with oxlint 1.91.0, see the setup below.

## Why ids matter

zod does not carry an id over to a schema derived from it. `Person.extend({ age: z.number() })` is a new schema without an id, even when `Person` has one, so the generator inlines it silently. The rule turns that into an error at the place where it is written.

## Setup with oxlint

```sh
pnpm add -D @t-rest/oxlint-plugin oxlint
```

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

JS plugins are in alpha in oxlint. The scope of the rule is the `files` of the override, so the rule has no glob option of its own.

## Setup with ESLint

```js
// eslint.config.js
import tRest from '@t-rest/oxlint-plugin'

export default [
  {
    files: ['src/models/**/*.ts'],
    plugins: { 't-rest': tRest },
    rules: {
      't-rest/require-model-id': [
        'error',
        { idFromPath: { root: 'src/models' } },
      ],
    },
  },
]
```

A CommonJS config gets the plugin from `require('@t-rest/oxlint-plugin').default`.

## What passes

An exported schema passes when it

- comes from `defineModels` of `@t-rest/core/zod`, or
- has `.meta({ id })` (or `.register(z.globalRegistry, { id })`) in its chain, followed only by `.describe()`, `.meta()`, `.readonly()` and `.register()` on another registry.

The generator only sees ids in `z.globalRegistry`, so `.register(z.registry(), { id })` on a registry created in the same file does not count. A registry the rule cannot resolve, such as one imported from another module, is not reported.

```ts
import { z } from 'zod'
import { defineModels } from '@t-rest/core/zod'

export const Person = z.object({ name: z.string() }).meta({ id: 'Person' })

export const { Invoice } = defineModels('Shop', { Invoice: z.object({}) })
```

## Reported mistakes

### `missingId`

```ts
export const Person = z.object({ name: z.string() }) // no id

// also: anything after the id that creates a new schema
export const Maybe = Person.meta({ id: 'Person' }).optional()
```

Fix: end the chain with `.meta({ id: 'Person' })` or pass the schema to `defineModels`.

### `derivedWithoutId`

Chains that use `.extend()`, `.safeExtend()`, `.pick()`, `.omit()`, `.partial()`, `.required()` or `.merge()` and do not end in their own id.

```ts
const Person = z.object({ name: z.string() }).meta({ id: 'Person' })

export const Admin = Person.extend({ admin: z.literal(true) }) // inlined silently
```

Fix: `Person.extend({ admin: z.literal(true) }).meta({ id: 'Admin' })`.

### `idMismatch`

Only checked with the `idFromPath` option. The id has to start with the prefix of the file path below `root`: segments joined by `_`, the extension and a trailing `index` dropped. In `src/models/v2024_01_01/shared/checkout.ts` the prefix is `V2024_01_01_Shared_Checkout`.

```ts
export const Total = z.string().meta({ id: 'Checkout_Total' }) // expected prefix V2024_01_01_Shared_Checkout
export const { Tax } = defineModels('Other.Namespace', { Tax: z.number() })
```

`defineModels` is checked on its namespace argument, where `.` counts as `_`. Files outside of `root` are not checked.

## Options

| Option | Type | Description |
| --- | --- | --- |
| `idFromPath.root` | `string` | Models directory, relative to the working directory. Enables `idMismatch`. |
| `idFromPath.case` | `'pascal' \| 'preserve'` | `pascal` (default) capitalizes each `-` or `.` separated word of a path segment, `preserve` keeps the segment as is. |

## What the rule does not see

The detection is syntactic and never reports what it cannot resolve.

- Only `export const` declarations are checked. `export { Name }` lists and default exports are not.
- A chain is a zod schema when it starts at a binding imported from `zod` (or `zod/v4`, `zod/mini`, `zod/v4-mini`), from a local `const` that is one, or from a name destructured from `defineModels`. Schemas imported from other files are not followed.
- An `id` that is not a string literal (a variable, a spread) counts as present and is not matched against the path.
- Passing one schema to `defineModels` twice is not detected.
