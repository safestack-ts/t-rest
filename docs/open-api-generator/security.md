# Security

Security schemes are values in `@t-rest/core`. You declare a scheme once, reference it in route meta, and `@t-rest/open-api-generator` writes the scheme and each operation's requirements. Security has no runtime effect on the server or the client. It only documents how a caller authenticates.

## Declare the schemes

`securityScheme(name, spec)` returns a scheme. `name` is its key under `components.securitySchemes`, and `spec` uses the fields of an OpenAPI Security Scheme Object.

<!-- example: security/schemes.ts -->
```ts
import { securityScheme } from '@t-rest/core'

export const bearer = securityScheme('bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

export const apiKey = securityScheme('apiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'x-api-key',
  description: 'Keys for server-to-server calls',
})

export const oauth = securityScheme('oauth', {
  type: 'oauth2',
  flows: {
    authorizationCode: {
      authorizationUrl: 'https://auth.shop.dev/authorize',
      tokenUrl: 'https://auth.shop.dev/token',
      scopes: {
        'orders:read': 'Read orders',
        'orders:write': 'Create and cancel orders',
      },
    },
  },
})
```

`spec.type` is one of these values:

- `http` with `scheme: 'bearer'` (and an optional `bearerFormat`) or `scheme: 'basic'`.
- `apiKey` with `in` (`header`, `query` or `cookie`) and `name`.
- `oauth2` with `flows`. Each flow lists its `scopes` as scope name to description.
- `openIdConnect` with `openIdConnectUrl`.

Every spec may have a `description`. Two schemes with one name and different specs fail generation with [`security/scheme-name-conflict`](diagnostics.md#securityscheme-name-conflict), so declare each scheme in one module and import it.

## Set the security of a route

`meta.security` lists alternatives. A caller must satisfy one alternative, and an alternative is satisfied when every scheme in it is.

<!-- example: security/routes.ts -->
```ts
import { BagOfRoutes, Route } from '@t-rest/core'
import { apiKey, bearer, oauth } from './schemes.js'

export const bag = BagOfRoutes.withoutVersioning()
  // the bag default from the generator config
  .addRoute(Route.get('/orders').response(204))
  // public
  .addRoute(Route.get('/health').metaData({ security: [] }).response(204))
  // bearer token or API key
  .addRoute(
    Route.get('/orders/:orderId')
      .metaData({ security: [[bearer], [apiKey]] })
      .response(204)
  )
  // an OAuth token with both scopes
  .addRoute(
    Route.post('/orders')
      .metaData({
        security: [[oauth.scopes('orders:read', 'orders:write')]],
      })
      .response(204)
  )
  // optional: signed-in callers see more
  .addRoute(
    Route.get('/products')
      .metaData({ security: [[bearer], []] })
      .response(204)
  )
  .build()
```

- `[]` makes a route public.
- `[[bearer], [apiKey]]` accepts a bearer token or an API key.
- `[[bearer, apiKey]]` would require both.
- `[[bearer], []]` makes authentication optional, because the empty alternative needs nothing.
- `oauth.scopes(...)` requests an `oauth2` scheme with scopes. Only scope names that the scheme's flows declare compile, so `oauth.scopes('orders:delete')` is a type error.

## Set a default for the bag

`config.security` is the security of every route without `meta.security`. `config.securitySchemes` lists schemes that every spec documents, also when no route of the spec uses them.

<!-- example: security/config.ts -->
```ts
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag } from './routes.js'
import { bearer, oauth } from './schemes.js'

export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  // routes without meta.security
  security: [[bearer]],
  // documented in every spec, also when no route of the spec uses it
  securitySchemes: [oauth],
  specs: [{ target: '3.1', output: 'openapi/orders.yaml' }],
})
```

The written document has no top-level `security`. Each operation carries its own requirements, and an operation without `security` is public:

```yaml
/health:
  get:
    operationId: getHealth
    responses:
      "204":
        description: No Content
/orders:
  get:
    operationId: getOrders
    responses:
      "204":
        description: No Content
    security:
      - bearer: []
  post:
    operationId: postOrders
    responses:
      "204":
        description: No Content
    security:
      - oauth:
          - orders:read
          - orders:write
```

A spec documents only the schemes its operations use, plus `config.securitySchemes`. A public spec filtered from the bag therefore leaves out the schemes of internal routes.

## Move from authorization headers to schemes

Routes that declare an `authorization` header in their validator document it as a header parameter. `config.securityFromHeaders` maps a header name to a scheme, so those routes get the scheme without route edits.

<!-- example: security/from-headers.ts -->
```ts
import { BagOfRoutes, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { z } from 'zod'
import { bearer } from './schemes.js'

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/orders')
      .validate(z.object({ headers: z.object({ authorization: z.string() }) }))
      .response(204)
  )
  .addRoute(
    Route.get('/products')
      .validate(
        z.object({
          headers: z.object({ authorization: z.string().optional() }),
        })
      )
      .response(204)
  )
  .build()

// GET /orders gets [[bearer]], GET /products gets [[bearer], []], and
// neither documents an authorization header parameter
export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  securityFromHeaders: { authorization: bearer },
  specs: [{ target: '3.1', output: 'openapi/orders.yaml' }],
})
```

A route with a required `authorization` header gets `[[bearer]]`, and a route with an optional one gets `[[bearer], []]`. The header is removed from the operation's parameters. The generator matches header names case-insensitively.

The security of a route comes from the first of these that applies:

1. `meta.security` of the route.
2. `securityFromHeaders`, when the route's validator declares a mapped header.
3. `config.security`.

When a route has a scheme in `meta.security` and also declares the header that the scheme sends, the header is left out of the parameters with [`security/header-and-scheme`](diagnostics.md#securityheader-and-scheme). The header of a scheme is `authorization` for `http` and `oauth2` schemes, the `name` of an `apiKey` in a header, or a header that `securityFromHeaders` maps.

To finish the move, set `meta.security` on the routes, or `config.security` for the bag, and remove the header from their validators. Then remove `securityFromHeaders`. Moving from a header parameter to a scheme changes the public documents once, on purpose.
