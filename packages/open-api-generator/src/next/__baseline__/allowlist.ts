/**
 * Every place where the new 3.0 output of a zod twin may differ from today's
 * baseline, as a JSON pointer into the projection of `writer-baseline.test.ts`.
 * An entry covers its pointer and everything below it, and must match a
 * difference, so a fixed difference also removes its entry.
 */
export const BASELINE_ALLOWLIST: readonly {
  readonly file: string
  readonly at: string
  readonly reason: string
}[] = [
  {
    file: 'type-variety.3.0.yaml',
    at: '/schemas/Drawing/properties/figures/items/discriminator',
    reason:
      'Contract 2.6 infers a discriminator: Circle and Square are components with a required, unique `kind` literal.',
  },
  ...[
    '/schemas/Drawing/properties/layer/enum',
    '/media/post ~1drawings request application~1json/properties/layer/enum',
  ].map((at) => ({
    file: 'type-variety.3.0.yaml',
    at,
    reason:
      "Enum values keep the order of the schema (1, 2, 3). Today's order (2, 1, 3) is the order in which the TypeScript checker stores the members of the union `1 | 2 | 3`.",
  })),
]
