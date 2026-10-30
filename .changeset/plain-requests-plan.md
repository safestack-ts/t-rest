---
'@t-rest/client': patch
'@t-rest/supertest-adapter': patch
---

Plan the url and the body of requests with `@t-rest/protocol` instead of `@t-rest/client-utils`, which is no longer a dependency. The requests sent are unchanged.
