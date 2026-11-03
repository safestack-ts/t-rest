# Vendored OpenAPI meta-schemas

These files are the official OpenAPI Initiative meta-schemas, copied byte for byte. `expect-valid-openapi.ts` validates generated documents against them. Do not edit them; replace them with a newer published version instead.

| File | Canonical URL (`$id`) | Source in `OAI/spec.openapis.org` | Last changed in commit | SHA-256 |
| --- | --- | --- | --- | --- |
| `openapi-3.0.schema.json` | https://spec.openapis.org/oas/3.0/schema/2024-10-18 | `oas/3.0/schema/2024-10-18` | `b43f858dc9131f4111e72457d48e781549561c9a` (2024-11-21) | `2385f5bbb8c37878daae73baeabe7f34b2f022a4a8c049329ee61f71796f039c` |
| `openapi-3.1.schema.json` | https://spec.openapis.org/oas/3.1/schema/2026-08-03 | `oas/3.1/schema/2026-08-03` | `2d5a84672c3a4757c49ab07a81e2a5cb6ccd0175` (2026-08-04) | `59f106413cb48c31299f96f024c938d3628aed6cd02cd14bcfb2fcaae7a130b6` |
| `openapi-3.2.schema.json` | https://spec.openapis.org/oas/3.2/schema/2026-08-30 | `oas/3.2/schema/2026-08-30` | `c0776954098a4a31ae026934c861d296e06bad38` (2026-08-31) | `ec53db6e114b768ff2d273b232bda210f51b70c5e57d57ac8daf7e8496a6e073` |

All three were fetched on 2026-11-03 from `OAI/spec.openapis.org` at `99da7018fa1a7768a9c5873e072f7fbc5924a7d3`, the repository that serves https://spec.openapis.org.

## How they are used

- 3.0 is a draft-04 schema and is compiled with `ajv-draft-04`. It validates Schema Objects too.
- 3.1 and 3.2 are draft 2020-12 schemas and are compiled with `ajv/dist/2020`. They are the `schema` variants, which check the document structure but not the contents of Schema Objects. The `schema-base` variants add Schema Object validation through the OpenAPI dialect, but they rely on `$dynamicRef` resolving to a `$dynamicAnchor` inside `$defs`, which Ajv does not support: with them, a valid `{ type: ['string', 'null'] }` schema is rejected.
- Ajv has the same gap for the `schema` variants, which reference the Schema Object as `{ "$dynamicRef": "#meta" }`. The helper replaces that reference with `{ "$ref": "#/$defs/schema" }` at load time. Without an extending dialect the two resolve to the same subschema, so the validation result is the one the published schema defines.
- Because the `schema` variants accept any object or boolean as a Schema Object, the helper also validates every Schema Object position (`components.schemas`, and each `schema` of a parameter, header or media type) on its own against JSON Schema 2020-12. That check rejects the 3.0 `nullable` keyword at any depth. The 3.0 boolean `exclusiveMinimum` and `exclusiveMaximum` already fail 2020-12.
- For every target, the helper rejects a local `$ref` that does not resolve inside the document.
