---
'@t-rest/core': minor
---

Add the `@t-rest/core/zod` subpath exporting `ze`, and depend on `@t-rest/protocol` for the wire rules (`HTTPMethod` is now derived from it and structurally unchanged). `ze` is still exported from the package root. `normalizePathPattern` and `joinPath` now delegate to `pathShape` and `joinPaths` from `@t-rest/protocol` and are deprecated in favour of them. The internal helpers `HashMap`, `typedLowerCase`, `typedUpperCase`, `isDefined`, `Identity`, `TypedIdentity`, `first`, `last`, `isNonEmptyArray`, `findNearestLowerDate`, `demoBagOfRoutes` and `versionHistory` are deprecated and will be removed from the public API in a future major. The `emptyValidation` message typo ("reuqest") is fixed.
