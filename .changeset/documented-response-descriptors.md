---
'@t-rest/core': minor
---

Response descriptors carry documentation. `json(schema, options)` takes a Standard Schema and types the body as its output, e.g. `json(Person, { description: 'The person' })`. `json<T>()` keeps typing the body by the type argument and takes the same options, `json<T>(schema)` does not compile, so a body type cannot disagree with its schema. The options are `description`, `headers` (one object schema, each property a response header), `examples` (typed against the body) and `id` (shares the response between routes). `text(contentType, options)`, `binary(contentType, options)` and `empty(options)` take the same options, `binary` and `empty` without `examples`. Descriptors built without options are unchanged.

`emptyValidation`, the validator of routes without `.validate()`, implements Standard JSON Schema and describes an object without properties. Its vendor changes from `'valizod'` to `'t-rest'`.

`text<T>()` and `text(contentType)` with a content type that may be `undefined` type the content type as `T | 'text/plain'`, since the descriptor falls back to `text/plain` at runtime.

The `zod` peer dependency range is raised from `^4.0.0` to `^4.5.0`. zod 4.2.0 is the first release whose schemas implement Standard JSON Schema (`~standard.jsonSchema`), but zod 4.2.0 and 4.2.1 throw when a schema registers an id that is already registered, which happens when a module registering schemas under an id is evaluated again. zod 4.3 and 4.4 do not emit `$ref` and `$defs` for a root schema with `.meta({ id })`, so the OpenAPI generator cannot name a model used directly as a body. zod 4.5.0 is the first release with both fixed. This release ships together with the major release of `@t-rest/core` that types route meta data, so the raised floor reaches users with that major.
