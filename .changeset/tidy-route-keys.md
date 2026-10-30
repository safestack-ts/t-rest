---
'@t-rest/core': patch
---

Fix route key collisions in `BagOfRoutes`: routes were stored under `method-path-version` joined with `-`, so e.g. `GET /x-2024` at version `01-01` and `GET /x` at version `2024-01-01` overwrote each other. Route keys are now hashed collision-free.
