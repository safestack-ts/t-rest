---
'@t-rest/express-server': minor
---

The setup-time `Route not found for path ...` errors are now `RouteSetupError`s with unchanged messages. `RouteSetupError` is recognized across module copies like `VersionResolutionError`.
