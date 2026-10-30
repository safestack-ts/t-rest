---
'@t-rest/core': major
'@t-rest/express-server': major
'@t-rest/client': major
'@t-rest/supertest-adapter': major
'@t-rest/open-api-generator': major
---

Typed responses: routes declare their responses per status code and content type, route handlers receive a `TypedResponse` instead of the native express response.

Migration:

- **Route definitions**: `.responses({ 200: json<Invoice>(), 404: json<Failure>() })` declares responses with the new `json`, `text`, `binary` and `empty` descriptors of `@t-rest/core`. `.response<T>()` remains as shorthand for `.responses({ 200: json<T>() })`, so routes answering with any other status have to declare it. `RouteDef['~responseType']` is replaced by `responses` and the phantom `~responses`, and the constructor of `RouteDef` takes the responses after the validator.
- **Route handlers** (`ExpressResponse` → `TypedResponse`): the third handler argument offers `status(code)`, `json(body)`, `header(name, value)` and `raw`. `status(code)` only accepts declared statuses and offers the body methods of the descriptor: `json`, `send`, `stream`, `file` or `end`. Use `response.raw` for the native express response, e.g. for redirects or cookies. Middlewares keep the native response. `HandlerReturnType` is removed.
- **Client**: `HTTPResponse` takes the responses of a route and is a discriminated union by `statusCode`. Declared statuses resolve, also error statuses, so check `statusCode` where a `catch` handled them before. Undeclared statuses reject, also undeclared 2xx statuses. `HTTPAdapter.request` receives the `responses` of the route as fourth argument, before `requestConfig`.
- **Supertest adapter**: `SupertestResponse` takes the responses of a route and is a discriminated union by `status`. Bodies of `text/*` responses are strings.
- **OpenAPI generator**: emits one entry per declared status with the content type of the descriptor. `RouteTypeInfo.output` is replaced by `responses`.
