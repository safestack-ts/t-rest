---
'@t-rest/supertest-adapter': minor
---

`supertest` is now a peer dependency (`^7.0.0`) and `@types/supertest` an optional peer dependency (`^7.2.0`), so the adapter shares your installed copy instead of bringing a second one. Install `supertest` alongside `@t-rest/supertest-adapter`.
