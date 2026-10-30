---
'@t-rest/client': patch
---

Expose response headers as `headers` on `HTTPResponse`, with lower-case keys. `AxiosHTTPAdapter` always returns them, custom `HTTPAdapter` implementations should return them too (the field is optional for backwards compatibility). This makes the metadata of downloads, e.g. `content-disposition` of a route declaring a `binary()` response, available without bypassing the client.
