# 3.0 baseline

Each fixture bag is written twice:

- `<fixture>.bag.ts` types its JSON responses with TypeScript (`json<T>()`), the way today's generator reads them.
- `<fixture>.zod.ts` is its zod twin. It describes the same routes with zod schemas only, and gives every type that today's output names as a component the same id. `twins.type.test.ts` checks that each zod schema outputs exactly the TypeScript type it replaces.

`baseline.test.ts` runs today's generator on each bag and compares the result with the committed `<fixture>[.<version>].3.0.yaml`. Each file is also checked against the OpenAPI 3.0 meta-schema. The new writer's 3.0 output for the zod twins is compared against these files.

To regenerate after a deliberate change to today's generator, run `pnpm vitest run src/next/__baseline__ -u` in `packages/open-api-generator` and review the diff.
