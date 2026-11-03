# Generator diagnostics

<!-- Generated from packages/open-api-generator/src/next/diagnostics/registry.ts by its docs test. Do not edit. -->

Every diagnostic has a code, a severity and a location (operation, slot, JSON pointer). `write()` writes nothing when any diagnostic is an error. Codes marked configurable accept a severity override in `config.diagnostics`.

| Code | Severity | Configurable |
| --- | --- | --- |
| [`naming/anonymous-recursion`](#naminganonymous-recursion) | warning | yes |
| [`naming/component-conflict`](#namingcomponent-conflict) | error | no |
| [`naming/direction-split`](#namingdirection-split) | info | no |
| [`naming/duplicate-id`](#namingduplicate-id) | error | no |
| [`naming/duplicate-response-id`](#namingduplicate-response-id) | error | no |
| [`naming/probable-model-without-id`](#namingprobable-model-without-id) | warning | yes |
| [`naming/reserved-response-id`](#namingreserved-response-id) | error | no |
| [`naming/shared-response-without-description`](#namingshared-response-without-description) | warning | yes |
| [`operation/duplicate-operation-id`](#operationduplicate-operation-id) | error | no |
| [`operation/duplicate-route`](#operationduplicate-route) | error | no |
| [`operation/example-invalid`](#operationexample-invalid) | error | no |
| [`operation/example-unverifiable`](#operationexample-unverifiable) | info | no |
| [`operation/invalid-meta`](#operationinvalid-meta) | warning | yes |
| [`operation/meta-not-serializable`](#operationmeta-not-serializable) | warning | yes |
| [`operation/mixed-query-encoding`](#operationmixed-query-encoding) | warning | yes |
| [`output/path-collision`](#outputpath-collision) | error | no |
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
| [`security/reserved-scheme-name`](#securityreserved-scheme-name) | error | no |
| [`security/scheme-name-conflict`](#securityscheme-name-conflict) | error | no |
| [`writer/discriminator-not-emitted`](#writerdiscriminator-not-emitted) | info | no |
| [`writer/downgrade`](#writerdowngrade) | warning | yes |
| [`writer/tag-undeclared`](#writertag-undeclared) | info | yes |

## naming/anonymous-recursion

**Recursive schema without id.**

A schema refers to itself but has no id, and `naming.nameAnonymous` did not name it. Inside a named type it is named after that type and its JSON pointer there; elsewhere after the operationId, the slot and the JSON pointer of its first use, which changes when the route does. Equal recursive schemas share one name; two different ones with one fallback name get a numeric suffix.

**Fix.** Give the recursive schema an id (`.meta({ id })` or `defineModels`), or name it in `naming.nameAnonymous`.

## naming/component-conflict

**Two components want one name.**

Two different types or shared responses end up with the same component name: ids that differ only in characters a component name cannot hold, an id that equals another id plus the input suffix, or one name from `naming.nameAnonymous` for different shapes. The later one gets a numeric suffix. Two fallback names of `naming/anonymous-recursion` that clash are not a conflict.

**Fix.** Rename one of the ids, or return different names from `naming.nameAnonymous`.

## naming/direction-split

**Input and output of one id differ.**

A schema with an id reads differently as request input and as response output, so it becomes two components: the output keeps the id, the input gets `naming.inputSuffix` (default `Input`). A nested `.default()`, `.transform()` or `.readonly()` splits the type that contains it and every type above it, since their inputs refer to the split input.

**Fix.** Nothing to do. To keep one component, use the schema in one direction only, or move the default out of the shared type.

## naming/duplicate-id

**Two schemas share one id.**

Two different schemas carry the same id (`.meta({ id })` or `defineModels`) inside one conversion or across routes.

**Fix.** Give each schema its own id, or reuse one schema value instead of two equal-looking ones.

## naming/duplicate-response-id

**Two responses share one id.**

Two response descriptors carry the same `id` but differ in their schema object or their docs (`description`, `headers`, `examples`, content type). Each is documented inline instead of as one shared response.

**Fix.** Create the descriptor once and reuse the value, or give each descriptor its own `id`.

## naming/probable-model-without-id

**Probable model without id.**

Request or response bodies of two or more operations contain the same inline object with at least two fields. It is inlined in each of them, so clients get one type per use.

**Fix.** Give the schema an id (`.meta({ id })` or `defineModels`) and reuse it, or lower the severity in `config.diagnostics`.

## naming/reserved-response-id

**Response id is reserved.**

A response descriptor has the `id` `__proto__`, which JSON and the model document drop as a record key. The response is documented inline.

**Fix.** Give the descriptor another `id`.

## naming/shared-response-without-description

**A shared response serves several statuses without a description.**

A response descriptor with an `id` and no `description` is used for more than one status, e.g. one `json(Error, { id })` for 400 and 404. The shared response is documented with the reason phrases of every status it serves, e.g. "Bad Request or Not Found".

**Fix.** Give the descriptor a `description` that fits every status, or create one descriptor per status.

## operation/duplicate-operation-id

**Two operations share one operationId.**

Two operations of one spec have the same `operationId`, from `meta.operationId`, the `operationId` hook or the derived default.

**Fix.** Set a unique `meta.operationId` on one of the routes, or make the hook return unique ids.

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

## operation/mixed-query-encoding

**Query parameter mixes text and JSON values.**

A query parameter accepts an object, array or tuple, which travels as JSON text, and also a plain string or string enum, which travels unquoted. The parameter is documented as JSON, so its text values are documented as JSON strings.

**Fix.** Accept the structured value only, for example with `ze.jsonObject`, or move the text value to a parameter of its own.

## output/path-collision

**Two outputs write one file.**

Two specs write the same file, either their `output` or their `<basename>.api-model.json` sidecar, e.g. `api.yaml` and `api.json`. Paths are compared ignoring case.

**Fix.** Give the specs outputs with different base names.

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

## security/reserved-scheme-name

**Security scheme name is reserved.**

A `securityScheme()` is named `__proto__`, which JSON and the model document drop as a record key. The scheme is left out of the model.

**Fix.** Give the scheme another name.

## security/scheme-name-conflict

**Two security schemes share one name.**

Two `securityScheme()` values have the same name but different specs.

**Fix.** Declare each scheme once and reuse the value, or give the schemes different names.

## writer/discriminator-not-emitted

**Discriminator not emitted.**

Every object member of a union has a required property with one string literal, unique across the members, but a member is an inline object rather than a component. A discriminator maps values to components, so none is emitted.

**Fix.** Give each member an id (`.meta({ id })` or `defineModels`) to get a discriminator.

## writer/downgrade

**Schema approximated for the target.**

The OpenAPI target cannot express a part of a schema, so the document describes it less precisely: tuple elements of different types, more than one schema example, a constrained `propertyNames`, or a non-`x-` annotation keyword in 3.0. The pointer locates the schema in the emitted document; `targets.md` describes each capability.

**Fix.** Target a newer OpenAPI version, accept the approximation, or lower the severity in `config.diagnostics`.

## writer/tag-undeclared

**Tag used but not declared.**

An operation uses a tag that `config.tags` does not declare. The tag is appended to the document tags without a description.

**Fix.** Declare the tag in `config.tags`, with a description.
