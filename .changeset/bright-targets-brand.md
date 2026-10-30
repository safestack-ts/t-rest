---
'@t-rest/supertest-adapter': minor
---

Creating the adapter for a typed application built on an express router now throws a `SupertestTargetError` (same message as before), which is recognized by `SupertestTargetError.isSupertestTargetError` and `instanceof`, also across module copies.
