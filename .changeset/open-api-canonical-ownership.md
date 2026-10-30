---
'@t-rest/open-api-generator': patch
---

Add `canonicalTypeOwnership` and `deriveRouteNamingContext` options. With `canonicalTypeOwnership`, a type re-exported by several public namespaces is named after a single canonical owner: the earliest version of the route's audience, or of a shared audience. Unowned types can inherit the route's namespace (`inheritRouteNamespaceForUnownedTypes`), modules can be marked as route-scoped (`routeScopedTypeModules`), and the generator throws on ambiguous owners. `deriveRouteNamingContext` sets the naming context of routes that do not reference a namespaced type, e.g. from the route path. Defaults keep the current naming.

Fix type conversion:

- Recursive types no longer overflow the stack. Recursive named unions such as zod's `JSONType` become self-referencing components, and anonymous recursive types (e.g. inferred from recursive zod schemas or recursive generic aliases) are cut off with an unconstrained schema.
- `bigint` and `symbol` primitives, typed arrays (`Uint8Array`, ...) and `Stream` subclasses (`Readable`, ...) are no longer expanded into the members of their wrapper types. Typed arrays are emitted as binary strings.
- `any` and `unknown` are emitted as `{}`, which accepts every value, instead of `type: object`.
- Index signatures (`{ [key: string]: T }`) are emitted as `additionalProperties`.
- `Set<T>` is emitted as an array of `T` with unique items.
- Optional and rest tuple elements (`[string, number?]`, `[A, ...A[]]`) give correct `minItems`/`maxItems`.
- Boolean literals (`true`) are emitted as `enum: [true]` instead of any boolean.
- Enums with computed members are emitted as numbers.
- Validators whose `~standard.types` is not optional are read correctly.
