---
'@t-rest/express-server': minor
'@t-rest/supertest-adapter': minor
---

Support Express 5 alongside Express 4. The `express` and `@types/express` peer dependencies now accept `^4.17.21 || ^5.0.0`, `@types/express` is an optional peer, and the `express-serve-static-core` placeholder peer dependency was removed.
