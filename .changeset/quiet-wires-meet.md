---
'@t-rest/protocol': major
---

New zero-dependency package `@t-rest/protocol` that owns the wire rules shared by the typed-rest packages: the HTTP method list (`HTTP_METHODS`, `methodSendsBody`), the path param grammar (`pathParamNames`, `pathShape`, `fillPathParams`, `joinPaths`), the query codec (`encodeQuery`, `decodeStructuredQueryValue`), `buildUrl` and `planRequest` for the url and body of a request, and the version header convention (`versionHeader`, `readVersion`, `writeVersion`). Its exports are plain functions only.
