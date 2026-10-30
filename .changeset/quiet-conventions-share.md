---
'@t-rest/supertest-adapter': minor
'@t-rest/client': minor
---

Add `versionInjectorFrom(convention)` to `@t-rest/client` and `@t-rest/supertest-adapter`. It returns a version injector that writes the version the way the convention declares, so that one `versionHeader('x-api-version')` from `@t-rest/protocol` can drive the server (`versionExtractorFrom`), supertest and the client.

```ts
const convention = versionHeader('x-api-version')

RESTClient.withVersioning(bag, '2024-01-01', adapter, versionInjectorFrom(convention))
SupertestAdapter.withVersioning(app, versionInjectorFrom(convention))
```
