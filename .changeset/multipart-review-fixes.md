---
'@t-rest/core': minor
'@t-rest/client': minor
'@t-rest/supertest-adapter': minor
'@t-rest/open-api-generator': minor
---

`.multipart()` takes options: `json: true` accepts JSON as well (`bodyEncoding` `'json-or-multipart'`, the request input is the union of both shapes, OpenAPI emits both media types), and `files` declares the file fields, which OpenAPI documents as binary parts. `RouteDef` without its body encoding type parameter now describes a json route.

The client passes the resolved body encoding to `HTTPAdapter.request` as a new optional argument instead of leaving adapters to detect `FormData`, and also recognizes `FormData` of other implementations. The axios peer dependency requires 1.3 or later, the first with native `FormData` support.

The supertest adapter encodes forms itself: `fields` only accept numbers, booleans and dates where the validator also takes their text, `null` is sent as an empty field, required arrays need an element, values with `toJSON` are sent through it, and objects multer would parse back as arrays are rejected. Routes requiring `file` require a file. A `Content-Type` of the call is kept, GET and DELETE take no `multipart` in `invalid`, and `adapter.untyped.<method>` sends valid requests the validator does not describe.
