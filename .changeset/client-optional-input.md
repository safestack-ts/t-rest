---
'@t-rest/client': patch
---

Keep the input types of routes whose input is entirely optional: the request config stays optional, but `query`, `body` and `params` are typed instead of dropped. Declare `axios` as optional peer dependency, so `AxiosHTTPAdapter` uses the consumer's axios types.
