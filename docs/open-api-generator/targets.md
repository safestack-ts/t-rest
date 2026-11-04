# OpenAPI targets

<!-- Generated from packages/open-api-generator/src/next/writer/capabilities.ts by its docs test. Do not edit. -->

One writer emits every target (3.0, 3.1, 3.2). The targets differ only in the capabilities below; everything else, such as key order, sorted paths and components, discriminators and parameter encodings, is the same. An approximation is reported as [`writer/downgrade`](diagnostics.md#writerdowngrade) with the capability name and a JSON pointer into the document.

| Capability | 3.0 | 3.1 | 3.2 |
| --- | --- | --- | --- |
| [`openapi`](#openapi) | `3.0.3` | `3.1.1` | `3.2.0` |
| [`nullable`](#nullable) | `nullable-keyword` | `null-type` | `null-type` |
| [`literal`](#literal) | `one-value-enum` | `const` | `const` |
| [`tuple`](#tuple) | `items-any-of` | `prefix-items` | `prefix-items` |
| [`exclusiveBounds`](#exclusivebounds) | `boolean` | `number` | `number` |
| [`schemaExamples`](#schemaexamples) | `example` | `examples` | `examples` |
| [`refSiblings`](#refsiblings) | `all-of-wrapper` | `siblings` | `siblings` |
| [`binary`](#binary) | `format` | `content-keywords` | `content-keywords` |
| [`propertyNames`](#propertynames) | `dropped` | `kept` | `kept` |
| [`annotations`](#annotations) | `extensions-only` | `any-keyword` | `any-keyword` |

## openapi

The `openapi` version the document declares.

## nullable

`nullable-keyword`: a nullable typed schema gets `nullable: true` (an enum also lists `null`), anything else becomes `oneOf: [schema, { type: string, enum: [null], nullable: true }]`. `null-type`: a typed schema gets `type: [type, "null"]`, anything else becomes `anyOf: [schema, { type: "null" }]`. In every target, a schema that already accepts null stays as it is, a named enum names the added `null` `Null`, and a discriminated union keeps `null` outside it: `anyOf: [{ oneOf: [...], discriminator }, null schema]`.

## literal

`one-value-enum`: a single literal is `enum: [value]`. `const`: it is `const: value`.

## tuple

`items-any-of`: a tuple is an array whose `items` match any element schema, with `minItems` and `maxItems`; element positions are lost when the elements differ (`writer/downgrade`). `prefix-items`: `prefixItems` with `items` for the rest or `items: false`.

## exclusiveBounds

`boolean`: `exclusiveMinimum: true` next to `minimum` (the stricter bound wins when both are set). `number`: `exclusiveMinimum: value`.

## schemaExamples

`example`: a Schema Object keeps its first example as `example`; more examples are dropped (`writer/downgrade`). `examples`: the list is kept. Media Type and parameter `examples` maps are the same in every target.

## refSiblings

`all-of-wrapper`: a reference with docs becomes `allOf: [{ $ref }]` with the docs next to it, since `$ref` siblings are ignored. `siblings`: the docs sit next to `$ref`.

## binary

`format`: a base64 `contentEncoding` is `format: byte`. In a body that is not JSON (a binary body or a multipart file part), a string with `contentMediaType` and no encoding is `format: binary`, and the Media Type Object or the multipart `encoding` documents its media type. Any other `contentMediaType` or `contentEncoding` is dropped and the string keeps its `format` (`writer/downgrade`). `content-keywords`: `contentMediaType` and `contentEncoding` are kept.

## propertyNames

`dropped`: a constrained `propertyNames` is left out (`writer/downgrade`). `kept`: it is emitted. Plain string keys need no `propertyNames` in any target.

## annotations

`extensions-only`: a Schema Object keeps only `x-` keywords among unknown annotations; others are dropped (`writer/downgrade`). `any-keyword`: every annotation keyword is kept.

## Implied bounds

zod integers carry `minimum` and `maximum` of ±`Number.MAX_SAFE_INTEGER`. The reader drops these bounds (`safe-integer-bounds`), so an integer without bounds in the document is a safe integer when it comes from zod.
