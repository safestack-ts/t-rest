# 3.0 baseline

The `<fixture>[.<version>].3.0.yaml` files are the output of the TypeScript-based generator that `buildOpenAPI` replaced (`@t-rest/open-api-generator@1.0.0-alpha.61`). They are frozen.

Each fixture bag is written twice:

- `<fixture>.bag.ts` types its JSON responses with TypeScript (`json<T>()`), the way the old generator read them.
- `<fixture>.zod.ts` is its zod twin. It describes the same routes with zod schemas only, and gives every type that the old output names as a component the same id. `twins.type.test.ts` checks that each zod schema outputs exactly the TypeScript type it replaces.

`writer-baseline.test.ts` builds each bag with its zod twin's schemas, writes 3.0, and compares the schema encodings (component schemas, parameter and media type schemas) with the frozen files. Every difference must be listed in `allowlist.ts` with its reason, and every entry must still match a difference.
