---
'@t-rest/core': patch
---

`ValidationError` is recognized across module copies (e.g. the ESM and the CJS build loaded side by side): `instanceof ValidationError` and the new `ValidationError.isValidationError(error)` check a global brand instead of the prototype chain. Subclasses keep the regular prototype check. Its `name` is now `'ValidationError'`.
