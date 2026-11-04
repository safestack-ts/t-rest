---
'@t-rest/oxlint-plugin': major
---

New zero-dependency package `@t-rest/oxlint-plugin` with the rule `t-rest/require-model-id` for oxlint (JS plugins) and ESLint. It reports exported zod schemas without an id (`missingId`), schemas derived with `.extend()`, `.pick()`, `.omit()`, `.partial()`, `.required()` or `.merge()` without an id of their own (`derivedWithoutId`, zod does not carry ids over, so the schema is inlined silently) and, with the `idFromPath` option, ids that do not start with the prefix of the file path (`idMismatch`). A schema passes when it comes from `defineModels` of `@t-rest/core/zod` or its chain contains `.meta({ id })` followed only by `.describe()`, `.meta()` and `.readonly()`.
