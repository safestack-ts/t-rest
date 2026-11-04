---
'@t-rest/core': major
---

Routes carry documentation for generators: typed meta data, security schemes, request examples and default responses of a bag.

- **`RouteMeta`** describes the documented keys of `.metaData()`: `summary`, `description`, `tags`, `deprecated`, `operationId`, `externalDocs`, `servers` and `security`, all optional. `.metaData()` checks these keys and keeps every other key with its own type, e.g. `.metaData({ summary: 'List products', public: true })` has the meta data type `{ summary: string; public: boolean }`. Routes without `.metaData()` keep the meta data type `unknown`.
- **Security schemes** are values: `securityScheme(name, spec)` declares one, `meta.security` lists alternatives of requirements, each satisfied by all of its schemes. `[]` is public and `[[bearer], []]` makes authentication optional. `oauth.scopes('read:me')` requests an oauth2 scheme with scopes, only the scopes its flows declare compile.
- **Request examples**: `.validate(validator, { examples })` takes examples typed against the input of the validator, routes expose them as `requestExamples`.
- **Default responses**: `bag.withDefaultResponses({ 400: json(ValidationErrorBody) })` returns a bag whose routes declare the default responses for the statuses they do not declare themselves, at runtime and in their types. Clients, servers and the supertest adapter treat a default status as declared. `combine()` is unchanged, defaults applied to a combined bag fill the routes of every bag.

Migration:

- **`.metaData()`** rejects values of the documented keys with another type, e.g. `.metaData({ tags: 'users' })`. Pass the documented type, e.g. `tags: ['users']`, or rename a custom key that collides with a documented one:

  ```ts
  // before
  Route.get('/users').metaData({ tags: 'users', deprecated: 'since 2024' })
  // after
  Route.get('/users').metaData({ tags: ['users'], deprecated: true, deprecatedSince: '2024' })
  ```

- **Generic helpers calling `.metaData(m)`** with an unconstrained type parameter no longer compile, since `m` is not known to satisfy the documented keys. Constrain the type parameter with `CheckMeta`, or give `m` a concrete type:

  ```ts
  // before
  const withMeta = <M>(m: M) => Route.get('/').metaData(m)
  // after
  const withMeta = <M extends CheckMeta<M>>(m: M) => Route.get('/').metaData(m)
  ```
