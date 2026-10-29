---
'@t-rest/express-server': patch
---

Fix params of branch paths being missing in handlers, e.g. `orgId` for `app.branch('/:orgId/projects')`. Branch routers are now created with `mergeParams: true`, so `request.params` in branch middlewares also contains the params of parent branch paths.
