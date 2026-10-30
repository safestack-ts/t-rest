---
'@t-rest/supertest-adapter': minor
'@t-rest/protocol': patch
---

Add `adapter.invalid.<method>` to the supertest adapter to send deliberately invalid input: `params`, `query` and `body` are `unknown` and optional, while path, version and response stay typed. Number, boolean and `null` bodies are now sent as JSON instead of failing or being dropped, and `fillPathParams` leaves placeholders untouched for `null` params instead of throwing.
