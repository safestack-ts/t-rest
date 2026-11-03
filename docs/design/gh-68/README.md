# Design record for issue #68

This folder records how the rewrite of `@t-rest/open-api-generator` and the related core route API changes were designed and checked. The user guides are in `docs/open-api-generator/`.

- `contract.md` is the design contract the implementation followed. Four models drafted competing designs, a judge on another model scored them, and four reviewers on different models attacked the merged design. Each rule that came from that review names its reviewers.
- `decisions.tsv` is the decision trail, one row per decision, with the reason, the evidence and the result. Rows are append-only, so a later row can supersede an earlier one. Implementation-time decisions in this file take precedence over `contract.md`.

## Deviations from the issue

- `meta.examples` is not implemented. Request examples go on `.validate(schema, { examples })` and response examples on the descriptors, because `.metaData()` can run before the route type exists and could not be typed against it.
- `naming/probable-model-without-id` is a warning, because existing factory schemas would otherwise fail the run.
- Security schemes are values (`securityScheme(name, spec)`) instead of names registered through a global `declare module`.
- Generated `$defs` keys such as `__schema0` are never trusted as names. They are merged into the named schema they copy or inlined, instead of being rejected.
- Names are computed once for the whole bag, so an internal route can add an `XInput` component to a public spec.
- The generated-docs drift check runs inside `pnpm test` (vitest file snapshots) instead of a separate CI step.
- Section 8 (the model diff) is a follow-up.
