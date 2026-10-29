---
'@t-rest/express-server': patch
---

Fix versioned routing: compute path param aliases relative to the path mounted in express, support path params containing underscores, fall back to the default version for an empty version, and respond with 400 (`VersionResolutionError`) for unresolvable versions
