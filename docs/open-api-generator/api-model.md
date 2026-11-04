# API model format

<!-- Generated from packages/open-api-generator/src/model/document-schema.ts by its docs test. Do not edit. -->

The generator writes the API model of each spec next to it as `<spec>.api-model.json`. This page describes `modelVersion` 1. The JSON Schema is [api-model.v1.schema.json](../../packages/open-api-generator/schema/api-model.v1.schema.json).

## Changelog

| modelVersion | Changes |
| --- | --- |
| 1 | Initial format. |

## ApiModelDocument

The API model of one spec: its operations and the types, shared responses and security schemes they reach.

| Field | Type | Required |
| --- | --- | --- |
| `modelVersion` | `1` | yes |
| `versioning` | object \| object | yes |
| `types` | map of [TypeDef](#typedef) | yes |
| `responses` | map of [Response](#response) | yes |
| `securitySchemes` | map of [SecurityScheme](#securityscheme) | yes |
| `operations` | [Operation](#operation)[] | yes |

## Docs

Documentation of a shape. None of it changes which values the shape accepts.

| Field | Type | Required |
| --- | --- | --- |
| `title` | string | no |
| `description` | string | no |
| `examples` | any JSON value[] | no |
| `default` | any JSON value | no |
| `deprecated` | boolean | no |
| `readOnly` | boolean | no |
| `writeOnly` | boolean | no |
| `extensions` | map of any JSON value | no |

## Field

An object property. Optionality lives here, never on the shape.

| Field | Type | Required |
| --- | --- | --- |
| `name` | string | yes |
| `required` | boolean | yes |
| `shape` | [Shape](#shape) | yes |

## MediaType

A body in one content type.

| Field | Type | Required |
| --- | --- | --- |
| `shape` | [Shape](#shape) | yes |
| `examples` | map of object | no |
| `encoding` | map of object | no |

## Operation

One route in one version. `key` is built from the normalized path, for example `GET /users/{} @2024-01-01`.

| Field | Type | Required |
| --- | --- | --- |
| `key` | string | yes |
| `method` | `"GET"` \| `"POST"` \| `"PUT"` \| `"PATCH"` \| `"DELETE"` | yes |
| `path` | string | yes |
| `version` | string | yes |
| `operationId` | string | yes |
| `summary` | string | no |
| `description` | string | no |
| `tags` | string[] | yes |
| `deprecated` | boolean | yes |
| `externalDocs` | object | no |
| `servers` | object[] | no |
| `parameters` | [Parameter](#parameter)[] | yes |
| `requestBody` | object | no |
| `responses` | map of object \| object | yes |
| `security` | object[][] | yes |
| `extensions` | map of any JSON value | yes |

## Parameter

A path, query or header parameter. `encoding: json` means the value travels as a JSON string.

| Field | Type | Required |
| --- | --- | --- |
| `name` | string | yes |
| `in` | `"path"` \| `"query"` \| `"header"` | yes |
| `required` | boolean | yes |
| `shape` | [Shape](#shape) | yes |
| `encoding` | `"plain"` \| `"json"` | yes |

## Response

One status of an operation. `content` is empty for a response without a body.

| Field | Type | Required |
| --- | --- | --- |
| `description` | string | yes |
| `headers` | object[] | yes |
| `content` | map of [MediaType](#mediatype) | yes |

## SecurityScheme

A security scheme, referenced by name from `Operation.security`.

### `type: "http"`

| Field | Type | Required |
| --- | --- | --- |
| `type` | `"http"` | yes |
| `scheme` | string | yes |
| `bearerFormat` | string | no |
| `description` | string | no |

### `type: "apiKey"`

| Field | Type | Required |
| --- | --- | --- |
| `type` | `"apiKey"` | yes |
| `in` | `"header"` \| `"query"` \| `"cookie"` | yes |
| `name` | string | yes |
| `description` | string | no |

### `type: "oauth2"`

| Field | Type | Required |
| --- | --- | --- |
| `type` | `"oauth2"` | yes |
| `flows` | map of any JSON value | yes |
| `description` | string | no |

### `type: "openIdConnect"`

| Field | Type | Required |
| --- | --- | --- |
| `type` | `"openIdConnect"` | yes |
| `openIdConnectUrl` | string | yes |
| `description` | string | no |

## Shape

A JSON wire value. `null` is a union member; a literal is a one-member enum; `ref.target` names a key of `types`.

### `kind: "unknown"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"unknown"` | yes |
| `docs` | [Docs](#docs) | no |

### `kind: "never"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"never"` | yes |
| `docs` | [Docs](#docs) | no |

### `kind: "null"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"null"` | yes |
| `docs` | [Docs](#docs) | no |

### `kind: "boolean"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"boolean"` | yes |
| `docs` | [Docs](#docs) | no |

### `kind: "string"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"string"` | yes |
| `format` | string | no |
| `pattern` | string | no |
| `minLength` | number | no |
| `maxLength` | number | no |
| `contentEncoding` | string | no |
| `contentMediaType` | string | no |
| `docs` | [Docs](#docs) | no |

### `kind: "number"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"number"` | yes |
| `integer` | boolean | yes |
| `format` | string | no |
| `minimum` | number | no |
| `maximum` | number | no |
| `exclusiveMinimum` | number | no |
| `exclusiveMaximum` | number | no |
| `multipleOf` | number | no |
| `docs` | [Docs](#docs) | no |

### `kind: "enum"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"enum"` | yes |
| `values` | string,number,boolean[] | yes |
| `names` | string[] | no |
| `docs` | [Docs](#docs) | no |

### `kind: "array"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"array"` | yes |
| `items` | [Shape](#shape) | yes |
| `minItems` | number | no |
| `maxItems` | number | no |
| `uniqueItems` | boolean | no |
| `docs` | [Docs](#docs) | no |

### `kind: "tuple"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"tuple"` | yes |
| `prefix` | [Shape](#shape)[] | yes |
| `rest` | [Shape](#shape) | no |
| `minItems` | number | no |
| `docs` | [Docs](#docs) | no |

### `kind: "object"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"object"` | yes |
| `fields` | [Field](#field)[] | yes |
| `additional` | [Shape](#shape) \| `false` | no |
| `propertyNames` | [Shape](#shape) | no |
| `minProperties` | number | no |
| `maxProperties` | number | no |
| `docs` | [Docs](#docs) | no |

### `kind: "union"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"union"` | yes |
| `members` | [Shape](#shape)[] | yes |
| `exclusive` | boolean | yes |
| `docs` | [Docs](#docs) | no |

### `kind: "intersection"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"intersection"` | yes |
| `members` | [Shape](#shape)[] | yes |
| `docs` | [Docs](#docs) | no |

### `kind: "ref"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"ref"` | yes |
| `target` | string | yes |
| `docs` | [Docs](#docs) | no |

## TypeDef

A type other shapes refer to. `anonymous` is recursion without an author id.

### `kind: "named"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"named"` | yes |
| `id` | string | yes |
| `direction` | `"input"` \| `"output"` | yes |
| `shape` | [Shape](#shape) | yes |

### `kind: "anonymous"`

| Field | Type | Required |
| --- | --- | --- |
| `kind` | `"anonymous"` | yes |
| `direction` | `"input"` \| `"output"` | yes |
| `shape` | [Shape](#shape) | yes |
