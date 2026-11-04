# Generator diagnostics

<!-- Generated from packages/open-api-generator/src/next/diagnostics/registry.ts by its docs test. Do not edit. -->

Every diagnostic has a code, a severity and a location (operation, slot, JSON pointer). `write()` writes nothing when any diagnostic is an error. Codes marked configurable accept a severity override in `config.diagnostics`.

| Code | Severity | Configurable |
| --- | --- | --- |
| [`naming/duplicate-id`](#namingduplicate-id) | error | no |
| [`operation/meta-not-serializable`](#operationmeta-not-serializable) | warning | yes |
| [`schema/conversion-failed`](#schemaconversion-failed) | error | no |
| [`schema/multipart-placeholder`](#schemamultipart-placeholder) | info | no |
| [`schema/no-json-schema`](#schemano-json-schema) | error | no |
| [`schema/unknown-request-slot`](#schemaunknown-request-slot) | warning | yes |
| [`schema/unrepresentable`](#schemaunrepresentable) | error | yes |
| [`schema/unrepresentable-request`](#schemaunrepresentable-request) | warning | yes |
| [`schema/unsupported-keyword`](#schemaunsupported-keyword) | warning | yes |

## naming/duplicate-id

**Two schemas share one id.**

Two different schemas carry the same id (`.meta({ id })` or `defineModels`) inside one conversion or across routes.

**Fix.** Give each schema its own id, or reuse one schema value instead of two equal-looking ones.

## operation/meta-not-serializable

**Route meta value is not JSON.**

A `.metaData()` key outside `RouteMeta` holds a value JSON cannot carry, such as a function, a class instance or a `Date`.

**Fix.** Store plain JSON values in custom meta keys, or accept that the key is missing from `Operation.extensions`.

## schema/conversion-failed

**Schema conversion failed.**

Converting the schema to JSON Schema threw, and the lenient retry threw too or the vendor has no lenient mode.

**Fix.** Replace the part the error names with a JSON-representable schema.

## schema/multipart-placeholder

**Multipart file field not representable.**

Every part of a request validator that JSON Schema cannot express is a file field declared in `.multipart({ files })`. The file part documentation replaces them.

**Fix.** Nothing to do.

## schema/no-json-schema

**Schema without Standard JSON Schema.**

A validator or response schema has no `~standard.jsonSchema`, so the generator cannot read its shape.

**Fix.** Use a schema library version that implements Standard JSON Schema (`~standard.jsonSchema`).

## schema/unknown-request-slot

**Unknown request validator key.**

The request validator has a top-level key other than `params`, `query`, `headers` and `body`. t-rest never fills it, so it is not documented.

**Fix.** Move the field into `params`, `query`, `headers` or `body`.

## schema/unrepresentable

**Response body not representable.**

A response schema contains a part JSON Schema cannot express (a `Date`, a transform output, a custom type). The lenient retry documents those parts as `{}`. A response body that cannot be represented is usually not JSON.

**Fix.** Describe the body as it travels on the wire, for example `z.iso.datetime()` instead of `z.date()`, or lower the severity in `config.diagnostics`.

## schema/unrepresentable-request

**Request part not representable.**

A request validator contains a part JSON Schema cannot express. The lenient retry documents those parts as `{}`.

**Fix.** Describe the field as it travels on the wire, or declare file fields in `.multipart({ files })`.

## schema/unsupported-keyword

**Unsupported JSON Schema keyword.**

The schema uses a validation keyword the model cannot carry (`not`, `if`/`then`/`else`, `patternProperties`, `contains`, `dependent*`, `unevaluated*`). The keyword is dropped, so the documented schema accepts more values than the validator.

**Fix.** Accept the wider documentation, or express the rule with supported keywords.
