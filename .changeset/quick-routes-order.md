---
'@t-rest/express-server': major
---

**BREAKING:** Every `.handle()` now registers its own express route on the router it is called on, using the path of its version. Express order matches typed order and the path param aliasing between versions is gone, as express fills `req.params` with the param names of the handled version.

- Middleware registered with `use()` between the handlers of two versions of a route now applies to the later version, as the types already claimed. Before, only the first handled version of a route kept its position, so later versions skipped the middleware.
- The versions of one route may be handled on the app and on branches or mounted router modules. A request is resolved against all versions of the application. If the resolved version is handled on a router the request never reaches, express responds with its 404.
- Handling the same route version twice within an application throws a `RouteSetupError` at setup (message `Route GET /users version 2024-01-01 is already handled`). Before, the second handler was silently ignored.
- The protected members of `VersionedRouting` (reachable through `.routing`) changed: `routes`, `mountedPaths`, `getRouteToExecute`, `getRoutesWithPathParamAliases`, `getRequestWithParamAliases` and `getRoutesSortedByVersion` are gone. `RouteBundle` and `ParamAlias` are no longer used.
- The generic parameters of `TypedExpressApplicationWithVersioning` are reordered to `<TRoutes, TRequest, TMountPath, TVersionHistory>`, matching `TypedRouterWithVersioning`.

```ts
// before
type App = TypedExpressApplicationWithVersioning<Routes, Request, History, '/'>

// after
type App = TypedExpressApplicationWithVersioning<Routes, Request, '/', History>
```

```ts
app.get('/users').version('2024-01-01').handle(handleV1)
const secured = app.use(authenticate)
secured.get('/users').version('2024-02-01').handle(handleV2)

// before: neither version ran `authenticate`, although v2's request type claimed it
// after:  v2 runs `authenticate`, v1 does not
```

To keep the previous behaviour, register router-level middleware after all versions of a route, or move it into the route-level `.middleware()` of the versions that need it.
