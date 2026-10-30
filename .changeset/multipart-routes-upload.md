---
'@t-rest/core': minor
'@t-rest/client': minor
'@t-rest/supertest-adapter': minor
'@t-rest/open-api-generator': minor
---

Add `.multipart()` to the route builder for routes taking `multipart/form-data`, available right after the method and path on POST, PUT and PATCH routes. `RouteDef` gets the `bodyEncoding` field and an optional type parameter for it. The new `RouteRequestInput` type replaces `body`, `file` and `files` of such routes with the wire format of a binding: `@t-rest/client` takes `body: FormData`, which `AxiosHTTPAdapter` always sends as multipart, and `@t-rest/supertest-adapter` takes `multipart: { fields, files }`. `@t-rest/open-api-generator` emits `multipart/form-data` as the media type of these routes.
