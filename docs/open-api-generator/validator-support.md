# Validator support

`@t-rest/open-api-generator` reads every schema through [Standard JSON Schema](https://standardschema.dev) and contains no code for a particular library. This page lists what a schema must provide, how each library's definitions are named, and the known limitations.

## Requirements

A schema that the generator reads implements `StandardJSONSchemaV1` from `@standard-schema/spec` 1.1. Route validators and `json(schema)` also need `StandardSchemaV1`, the validation half, which t-rest uses to type and validate requests and responses.

- The generator calls `~standard.jsonSchema.input({ target: 'draft-2020-12' })` for request validators and `~standard.jsonSchema.output({ target: 'draft-2020-12' })` for response schemas and response headers. It also reads the input of every response schema, see [Strictness of response objects](#strictness-of-response-objects).
- A named type is an entry of `$defs` that the result refers to with `$ref`. Whether the generator uses the `$defs` key as the component name depends on the library, see the [support matrix](#support-matrix).
- A schema without `~standard.jsonSchema` fails generation with [`schema/no-json-schema`](diagnostics.md#schemano-json-schema).
- When a conversion throws, the generator retries once with the library's lenient options. Only zod has them (`{ unrepresentable: 'any' }`). A conversion that still throws fails generation with [`schema/conversion-failed`](diagnostics.md#schemaconversion-failed).

The generator converts each schema object once per `buildOpenAPI` call per direction, so a schema shared by many routes costs one conversion.

## Support matrix

The generator picks a policy by `~standard.vendor`.

| Library | `~standard.vendor` | `$defs` keys | Notes |
| --- | --- | --- | --- |
| zod 4.5 or later | `zod` | Trusted as ids. Generated keys such as `__schema0` are not ids. | Tested with zod. The lenient retry documents unrepresentable parts as `{}`. Safe-integer bounds are dropped. |
| Valibot | `valibot` | Trusted when present. Valibot emits `$defs` only for definitions the author names. | The policy is tested with hand-written JSON Schema, not with Valibot itself. |
| ArkType | `arktype` | Never trusted, every definition is inlined. ArkType keys depend on what else the process has defined. | The policy is tested with hand-written JSON Schema, not with ArkType itself. |
| t-rest | `t-rest` | Trusted. | `emptyValidation`, the validator of a route without `.validate()`. |
| Any other library | its vendor | Never trusted, unless `vendors.trust` lists the vendor. | |

An inlined definition keeps its structure and loses its name. A recursive definition cannot be inlined, so it becomes an anonymous type with a fallback name and [`naming/anonymous-recursion`](diagnostics.md#naminganonymous-recursion), unless [`naming.nameAnonymous`](naming-components.md#name-schemas-that-factories-create) names it.

`@t-rest/core` and the generator need zod 4.5.0 or later. zod 4.2.0 is the first release that implements Standard JSON Schema, but 4.2.0 and 4.2.1 throw when a module that registers ids is evaluated again. zod 4.3 and 4.4 convert a root schema with `.meta({ id })` without `$ref` and `$defs`, so the generator cannot name a model that is a body on its own. zod 4.5.0 fixes both.

## Trust another library

Add the vendor to `vendors.trust` when its `$defs` keys are stable ids that the author sets.

<!-- example: validator-support/custom-vendor.ts -->
```ts
import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from '@standard-schema/spec'
import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

interface Point {
  x: number
  y: number
}

const pointJsonSchema = {
  $ref: '#/$defs/Geo_Point',
  $defs: {
    Geo_Point: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
      required: ['x', 'y'],
    },
  },
}

const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Point).x === 'number' &&
  typeof (value as Point).y === 'number'

// what a schema library provides: validation and both JSON Schema directions
export const Point: StandardSchemaV1<Point> & StandardJSONSchemaV1<Point> = {
  '~standard': {
    version: 1,
    vendor: 'geo-schema',
    validate: (value) =>
      isPoint(value) ? { value } : { issues: [{ message: 'Not a point' }] },
    jsonSchema: {
      input: () => pointJsonSchema,
      output: () => pointJsonSchema,
    },
  },
}

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/origin').responses({ 200: json(Point) }))
  .build()

// Geo_Point becomes a component; without the trust entry it is inlined
export const build = buildOpenAPI({
  bag,
  info: { title: 'Geo API' },
  vendors: { trust: ['geo-schema'] },
  specs: [{ target: '3.1', output: 'openapi/geo.yaml' }],
})
```

With the trust entry, `GET /origin` returns a `$ref` to the `Geo_Point` component. Without it, the generator writes the object inline.

## Known limitations

### Strictness of response objects

zod marks every plain object as `additionalProperties: false` in its output conversion. The generator keeps that keyword in a response only when the input conversion of the same schema has it too, so `z.object()` stays open and `z.strictObject()` stays closed. An object piped into another object, `A.pipe(B)`, therefore documents the strictness of `A`, the input object:

- `z.object(shape).pipe(z.strictObject(shape))` is documented as open.
- `z.strictObject(shape).pipe(z.object(shape))` is documented as closed.

### Response bodies that JSON Schema cannot represent

A `z.date()`, a transform output or a custom type in a response fails generation with [`schema/unrepresentable`](diagnostics.md#schemaunrepresentable). Such a body is usually not what travels on the wire, so describe the wire value, for example `z.iso.datetime()` instead of `z.date()`. The lenient retry documents the part as `{}`. The diagnostic is configurable, so with a lower severity in `config.diagnostics` the document keeps that placeholder.

The same part in a request validator is a warning, [`schema/unrepresentable-request`](diagnostics.md#schemaunrepresentable-request), and is documented as `{}`. When every such part is a file field of `.multipart({ files })`, it is an info, [`schema/multipart-placeholder`](diagnostics.md#schemamultipart-placeholder), and the file parts document it.

### Keywords the model cannot carry

`not` (other than `not: {}`, which allows no value), `if`, `then`, `else`, `patternProperties`, `contains`, the `dependent*` keywords and the `unevaluated*` keywords are dropped with [`schema/unsupported-keyword`](diagnostics.md#schemaunsupported-keyword). The documented schema then accepts more values than the validator does.
