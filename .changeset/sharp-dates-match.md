---
'@t-rest/core': patch
---

Resolve a date version equal to a version history entry (e.g. sent as a full ISO timestamp) to that entry, always return `null` for unresolvable date versions, and support path params containing underscores in `normalizePathPattern`
