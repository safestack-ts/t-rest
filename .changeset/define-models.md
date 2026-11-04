---
'@t-rest/core': minor
---

Add `defineModels(namespace, models)` to `@t-rest/core/zod`. It gives every zod schema the id `<namespace>_<key>` in zod's global registry, with the dots of the namespace replaced by underscores, so documentation generators name it by that id: `defineModels('V2024_01_01.Shared', { Person })` registers `V2024_01_01_Shared_Person`. It returns the same keys with the same schemas, e.g. `export const { Person } = defineModels(...)`. Schemas that nest a model before the call reference it by its id, and existing meta data such as a description is kept. A schema that already has another id, from `.meta({ id })` or an earlier `defineModels`, becomes an alias that references it. Ids other than letters, digits and underscores throw before any model of the call is registered. Pass a schema to `defineModels` once and use the returned schema.
