---
'@t-rest/open-api-generator': patch
---

Fix OpenAPI spec assembly: keep `info.description` and `info.contact`, emit routes whose paths differ only in parameter names under one path item, detect same-named types with different shapes within a single route, and scope route naming contexts to the exported bag of routes (including unversioned routes and separate validator input context).
