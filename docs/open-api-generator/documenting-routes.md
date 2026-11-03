# Documenting routes

`@t-rest/open-api-generator` documents a route from the schemas of its validator and its response descriptors, from the options of those descriptors, and from its `.metaData()`. This guide shows what to write in each place and which OpenAPI field it becomes.

## Describe fields in the schema

The generator reads schemas through Standard JSON Schema, so every keyword the validator emits reaches the document. For zod 4:

<!-- example: documenting-routes/schema-metadata.ts -->
```ts
import { z } from 'zod'

export const Product = z
  .object({
    id: z.uuid().describe('Assigned by the server'),
    name: z.string().min(1).max(120),
    price: z
      .number()
      .positive()
      .meta({ examples: [12.9] }),
    sku: z.string().regex(/^[A-Z]{3}-\d{4}$/),
    status: z
      .enum(['draft', 'active'])
      .meta({ 'x-enum-varnames': ['Draft', 'Active'] }),
    legacyCode: z.string().optional().meta({ deprecated: true }),
  })
  .meta({ id: 'Catalog_Product', title: 'Product', description: 'A product' })

export const NewProduct = Product.omit({ id: true }).meta({
  id: 'Catalog_NewProduct',
})
```

| zod | Schema Object field |
| --- | --- |
| `.describe(text)`, `.meta({ description })` | `description` |
| `.meta({ title })` | `title` |
| `.meta({ examples: [value] })` | `examples` (3.1, 3.2), `example` with the first value (3.0) |
| `.meta({ deprecated: true })` | `deprecated` |
| `.meta({ 'x-name': value })` | `x-name` |
| `.default(value)` | `default` |
| `.readonly()` | `readOnly: true` in responses, dropped in requests |
| `.optional()` | the field is left out of `required` |
| `.min()`, `.max()` on a string | `minLength`, `maxLength` |
| `.min()`, `.max()`, `.positive()` on a number | `minimum`, `maximum`, `exclusiveMinimum` |
| `.regex(pattern)` | `pattern` |
| `z.uuid()`, `z.email()` and other string formats | `format`, and the `pattern` zod emits |
| `z.int()` | `type: integer` |
| `.meta({ 'x-enum-varnames': names })` on an enum | `x-enum-varnames` |

`z.int()` also emits the bounds of a safe integer. The generator drops them, so an integer without bounds in the document is a safe integer. [OpenAPI targets](targets.md) lists how 3.0 writes nullable values, literals, tuples, exclusive bounds and examples.

A `.default()`, `.transform()` or `.readonly()` makes a schema read differently as request and as response. A schema with an id that is used in both directions then becomes two components, see [Naming components](naming-components.md#expect-a-second-component-for-input-that-differs-from-output).

## Document responses on the descriptor

`json(schema, options)` types the body by the output of the schema and documents it. `text`, `binary` and `empty` take the same `description` and `headers` options. `json` and `text` also take `examples`.

<!-- example: documenting-routes/responses.ts -->
```ts
import { binary, empty, json, Route, text } from '@t-rest/core'
import { z } from 'zod'
import { Product } from './schema-metadata.js'

export const getProduct = Route.get('/products/:productId')
  .validate(z.object({ params: z.object({ productId: z.uuid() }) }))
  .responses({
    200: json(Product, {
      description: 'The product',
      headers: z.object({
        etag: z.string().describe('Version of the product'),
        'cache-control': z.string().optional(),
      }),
      examples: {
        coffee: {
          summary: 'A bag of coffee',
          value: {
            id: '7f6c1d2e-8a4b-4c3d-9e2f-1a2b3c4d5e6f',
            name: 'Coffee',
            price: 12.9,
            sku: 'COF-0001',
            status: 'active',
          },
        },
      },
    }),
    304: empty({ description: 'The product did not change' }),
    404: text('text/plain', { description: 'No product with this id' }),
  })

export const getManual = Route.get('/products/:productId/manual')
  .validate(z.object({ params: z.object({ productId: z.uuid() }) }))
  .responses({
    200: binary('application/pdf', { description: 'The manual as PDF' }),
  })
```

- `description` becomes the response description. Without it, the generator uses the reason phrase of the status, such as `OK` or `Not Found`.
- `headers` is one object schema. Each property becomes a response header, and the header is `required` unless the property is optional.
- `examples` becomes the `examples` map of the media type. The generator validates each example with the descriptor schema and leaves out an example that fails, with [`operation/example-invalid`](diagnostics.md#operationexample-invalid). When the schema reads differently as input and as output, for example because of a default, it cannot check the example and reports [`operation/example-unverifiable`](diagnostics.md#operationexample-unverifiable).
- `binary(contentType)` is a string with `contentMediaType` in 3.1 and 3.2, and `format: binary` in 3.0.

`json<T>()` without a schema still types the body, but the generator documents it as any JSON value and reports [`response/untyped-json`](diagnostics.md#responseuntyped-json).

## Add request examples to the validator

`.validate(schema, { examples })` takes examples typed against the input of the validator. An example holds the whole request, so the generator validates it with the route validator. The `body` of each valid example becomes an example of the request body.

<!-- example: documenting-routes/request-examples.ts -->
```ts
import { json, Route } from '@t-rest/core'
import { z } from 'zod'
import { NewProduct, Product } from './schema-metadata.js'

export const createProduct = Route.post('/products')
  .validate(z.object({ body: NewProduct }), {
    examples: {
      coffee: {
        summary: 'A bag of coffee',
        value: {
          body: {
            name: 'Coffee',
            price: 12.9,
            sku: 'COF-0001',
            status: 'draft',
          },
        },
      },
    },
  })
  .responses({ 201: json(Product) })
```

Route meta has no `examples` key. Request examples live on `.validate()` and response examples on the descriptor, because both are typed against their schema there.

## Share error responses across routes

`bag.withDefaultResponses(map)` adds responses to every route of a built bag. A route keeps its own response for a status it declares itself. A descriptor with an `id` becomes a shared response under `components.responses`, and each route refers to it.

<!-- example: documenting-routes/default-responses.ts -->
```ts
import { BagOfRoutes, json } from '@t-rest/core'
import { z } from 'zod'
import { createProduct } from './request-examples.js'
import { getManual, getProduct } from './responses.js'

const Problem = z
  .object({ message: z.string(), issues: z.array(z.string()) })
  .meta({ id: 'Problem' })

export const badRequest = json(Problem, {
  id: 'BadRequest',
  description: 'The request does not match the route',
})

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(getProduct)
  .addRoute(getManual)
  .addRoute(createProduct)
  .build()
  .withDefaultResponses({
    400: badRequest,
    500: json(Problem, {
      id: 'InternalError',
      description: 'Unexpected error',
    }),
  })
```

Every operation of `bag` documents `400` as `$ref: "#/components/responses/BadRequest"` and `500` as `$ref: "#/components/responses/InternalError"`. Create a shared descriptor once and reuse the value, like `badRequest`. Two descriptors with one `id` are one shared response only when they have the same schema object and equal docs. Otherwise generation fails with [`naming/duplicate-response-id`](diagnostics.md#namingduplicate-response-id). A descriptor with an `id` and no `description` that serves several statuses gets the reason phrases of all of them, such as `Bad Request or Not Found`, with [`naming/shared-response-without-description`](diagnostics.md#namingshared-response-without-description).

A default response documents a status. It does not send it. When a request fails validation, `@t-rest/express-server` passes a `ValidationError` to `next(err)`, and your error handler writes the response. Make that handler send the body that the `400` descriptor declares.

## Set the operationId

The `operationId` of an operation comes from `meta.operationId`, else from the `operationId` hook of the config, else from the method and the path.

<!-- example: documenting-routes/operation-id.ts -->
```ts
import { BagOfRoutes, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

export const bag = BagOfRoutes.withoutVersioning()
  // operationId: listOrders, from meta
  .addRoute(
    Route.get('/orders').metaData({ operationId: 'listOrders' }).response(204)
  )
  // operationId: ordersCancel, from the hook
  .addRoute(Route.post('/orders/:orderId/cancel').response(204))
  // operationId: getOrdersByOrderId, derived from method and path
  .addRoute(Route.get('/orders/:orderId').response(204))
  .build()

export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  operationId: (route) =>
    route.path.endsWith('/cancel') ? 'ordersCancel' : undefined,
  specs: [{ target: '3.1', output: 'openapi/orders.yaml' }],
})
```

The hook receives the same `RouteView` as a spec `filter` and returns `undefined` to use the derived id. The derived id is the lower-case method followed by the path segments in PascalCase, with `By` before a path parameter, so `GET /orders/:orderId` becomes `getOrdersByOrderId`. Two operations of one spec with one `operationId` fail generation with [`operation/duplicate-operation-id`](diagnostics.md#operationduplicate-operation-id).

## Describe the operation in route meta

`.metaData()` checks the keys of `RouteMeta` and keeps every other key with its own type.

<!-- example: documenting-routes/route-meta.ts -->
```ts
import { BagOfRoutes, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/orders')
      .metaData({
        summary: 'List orders',
        description: 'Newest first.',
        tags: ['orders'],
        externalDocs: { url: 'https://docs.shop.dev/orders' },
        // keys outside RouteMeta keep their own type
        audience: 'public',
        'x-rate-limit': 100,
      })
      .response(204)
  )
  .addRoute(
    Route.delete('/orders')
      .metaData({ deprecated: true, audience: 'internal' })
      .response(204)
  )
  .build()

export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  tags: [{ name: 'orders', description: 'Orders of a customer' }],
  specs: [
    {
      target: '3.1',
      output: 'openapi/public.yaml',
      // route.meta.audience is string | undefined
      filter: (route) => route.meta.audience === 'public',
    },
  ],
})
```

`summary`, `description`, `tags`, `deprecated`, `externalDocs` and `servers` become the operation fields of the same name, and `security` becomes the operation security (see [Security](security.md)). Declare each tag in the `tags` of the config to give it a description. A tag that only routes use is appended without one, with [`writer/tag-undeclared`](diagnostics.md#writertag-undeclared).

Other keys are yours:

- The `filter` of a spec and the `operationId` hook see them on `route.meta`, typed from every route of the bag. `route.meta.audience` above is `string | undefined`.
- Keys that start with `x-` become operation extensions in the document, like `x-rate-limit: 100`.
- Every key with a JSON value is kept in the `extensions` of the operation in the `api-model.json` sidecar. A value that JSON cannot hold, such as a function or a `Date`, is left out with [`operation/meta-not-serializable`](diagnostics.md#operationmeta-not-serializable).

A `RouteMeta` key with a value of the wrong type, for example behind a `@ts-expect-error`, is left out with [`operation/invalid-meta`](diagnostics.md#operationinvalid-meta).
