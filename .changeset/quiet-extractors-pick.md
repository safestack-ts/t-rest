---
'@t-rest/express-server': minor
---

Add `versionExtractorFrom(convention, options?)` to build a version extractor from the shared `versionHeader` convention of `@t-rest/protocol` (pass `parseDate` for date versions), add the `RouteSetupError` export, and make the version history argument of `TypedExpressApplication.withVersioning` optional: it is taken from the bag of routes now. The overload with the explicit version history is deprecated.

```ts
// before
TypedExpressApplication.withVersioning(expressApp, bag, versionHistory, extractor)

// after
TypedExpressApplication.withVersioning(expressApp, bag, extractor)
```
