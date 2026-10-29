---
'@t-rest/express-server': patch
---

branch() now merges parent path params into the branched router, and defineMiddleware forwards async middleware errors to next() instead of leaving the request hanging
