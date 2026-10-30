---
'@t-rest/supertest-adapter': patch
---

Add the `expressApp` option to the supertest adapter config to send requests to the root express application of a typed application built on an express router, so the middlewares and the mount path of the root application apply. A typed application built on a router without `expressApp` now throws when the adapter is created, instead of requests the router does not handle never completing. `DefaultSupertestAdapterConfig` is exported.
