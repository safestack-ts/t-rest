# Generator diagnostics

<!-- Generated from packages/open-api-generator/src/next/diagnostics/registry.ts by its docs test. Do not edit. -->

Every diagnostic has a code, a severity and a location (operation, slot, JSON pointer). `write()` writes nothing when any diagnostic is an error. Codes marked configurable accept a severity override in `config.diagnostics`.

| Code | Severity | Configurable |
| --- | --- | --- |
| [`naming/duplicate-id`](#namingduplicate-id) | error | no |
| [`naming/duplicate-response-id`](#namingduplicate-response-id) | error | no |
| [`naming/shared-response-without-description`](#namingshared-response-without-description) | warning | yes |
| [`operation/duplicate-route`](#operationduplicate-route) | error | no |
| [`operation/example-invalid`](#operationexample-invalid) | error | no |
| [`operation/example-unverifiable`](#operationexample-unverifiable) | info | no |
| [`operation/invalid-meta`](#operationinvalid-meta) | warning | yes |
| [`operation/meta-not-serializable`](#operationmeta-not-serializable) | warning | yes |
| [`response/untyped-json`](#responseuntyped-json) | warning | yes |
| [`schema/conversion-failed`](#schemaconversion-failed) | error | no |
| [`schema/multipart-placeholder`](#schemamultipart-placeholder) | info | no |
| [`schema/no-json-schema`](#schemano-json-schema) | error | no |
| [`schema/request-not-object`](#schemarequest-not-object) | warning | yes |
| [`schema/unknown-request-slot`](#schemaunknown-request-slot) | warning | yes |
| [`schema/unrepresentable`](#schemaunrepresentable) | error | yes |
| [`schema/unrepresentable-request`](#schemaunrepresentable-request) | warning | yes |
| [`schema/unsupported-keyword`](#schemaunsupported-keyword) | warning | yes |
| [`security/header-and-scheme`](#securityheader-and-scheme) | warning | yes |
| [`security/scheme-name-conflict`](#securityscheme-name-conflict) | error | no |

## naming/duplicate-id

**Two schemas share one id.**

Two different schemas carry the same id (`.meta({ id })` or `defineModels`) inside one conversion or across routes.

**Fix.** Give each schema its own id, or reuse one schema value instead of two equal-looking ones.

## naming/duplicate-response-id

**Two responses share one id.**

Two response descriptors carry the same `id` but differ in their schema object or their docs (`description`, `headers`, `examples`, content type). Each is documented inline instead of as one shared response.

**Fix.** Create the descriptor once and reuse the value, or give each descriptor its own `id`.

## naming/shared-response-without-description

**A shared response serves several statuses without a description.**

A response descriptor with an `id` and no `description` is used for more than one status, e.g. one `json(Error, { id })` for 400 and 404. The shared response is documented with the reason phrases of every status it serves, e.g. "Bad Request or Not Found".

**Fix.** Give the descriptor a `description` that fits every status, or create one descriptor per status.

## operation/duplicate-route

**Two routes share one operation.**

Two routes of one version have the same method and paths that differ only in parameter names, e.g. `/users/:id` and `/users/:userId`. Requests cannot tell them apart; only the first is documented.

**Fix.** Remove one of the routes, or give them different paths.

## operation/example-invalid

**Example does not match its schema.**

A request example (`.validate(schema, { examples })`) fails the route validator, or a response example fails the schema of its `json(schema, { examples })` descriptor. The example is left out.

**Fix.** Correct the example value, or the schema if the example shows the intended data.

## operation/example-unverifiable

**Example not validated.**

An example cannot be checked: its descriptor has no schema, its schema reads differently as input and as output (a default, a transform), or the validator only validates asynchronously. The example is documented as written.

**Fix.** Nothing to do; check the example by hand.

## operation/invalid-meta

**Route meta value has the wrong type.**

A `RouteMeta` key of `.metaData()` holds a value of another type at runtime, e.g. `tags: 'users'` behind a `@ts-expect-error`. The key is left out of the operation.

**Fix.** Pass the value with the type `RouteMeta` declares for the key.

## operation/meta-not-serializable

**Route meta value is not JSON.**

A `.metaData()` key outside `RouteMeta` holds a value JSON cannot carry, such as a function, a class instance or a `Date`.

**Fix.** Store plain JSON values in custom meta keys, or accept that the key is missing from `Operation.extensions`.

## response/untyped-json

**JSON response without schema.**

A response is declared with `json<T>()`, so only TypeScript knows its body. It is documented as any JSON value.

**Fix.** Pass the schema: `json(schema)`.

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

## schema/request-not-object

**Request validator is not an object.**

The request validator is not an object schema, for example a union of objects. Its slots cannot be split, so the request is not documented.

**Fix.** Validate the request with one object schema whose keys are `params`, `query`, `headers` and `body`.

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

## security/header-and-scheme

**Header covered by a security scheme.**

The route declares a header in its validator and a security scheme in `meta.security` that sends the same header (`authorization` for `http` and `oauth2` schemes, the header name of an `apiKey`, or a header mapped by `securityFromHeaders`). The header parameter is left out; the scheme documents it.

**Fix.** Remove the header from the validator's `headers`, or the scheme from `meta.security`.

## security/scheme-name-conflict

**Two security schemes share one name.**

Two `securityScheme()` values have the same name but different specs.

**Fix.** Declare each scheme once and reuse the value, or give the schemes different names.
