# Typed responses

Routes declare their responses per status code. Each descriptor carries the kind of body and its content type, at runtime and on the type level:

```ts
import { binary, empty, json, Route, text } from '@t-rest/core'

Route.get('/invoices/:id')
  .validate(...)
  .responses({
    200: json<Invoice>(),
    404: json<{ error: string }>(),
  })

Route.get('/invoices/:id/pdf').responses({
  200: binary('application/pdf'),
  404: json<{ error: string }>(),
})

Route.get('/invoices/export').responses({ 200: text('text/csv') })

Route.delete('/invoices/:id').responses({ 204: empty() })
```

`.response<T>()` is a shorthand for `.responses({ 200: json<T>() })`, `.response<T>(201)` and `.response<T>(202)` for another success status and `.response(204)` for `.responses({ 204: empty() })`.

`RouteOutput<typeof routes, 'GET', '/invoices/:id'>` is the union of the bodies of all statuses, `RouteOutput<typeof routes, 'GET', '/invoices/:id', '', 200>` the body of a single status.

## Handlers

The third argument of a route handler is a `TypedResponse<TRoute>`. Undeclared statuses, bodies of another status and body methods of another kind are compile errors. Body methods set the `Content-Type` of the descriptor, unless a `Content-Type` has been set before, e.g. `response.header('content-type', 'application/problem+json')`.

| Descriptor | Methods of `response.status(code)`                     |
| ---------- | ------------------------------------------------------ |
| `json<T>`  | `json(body: T)`, `send(body: T)`                       |
| `text`     | `send(body: string)`                                   |
| `binary`   | `send(body: Uint8Array)`, `stream(body)`, `file(path)` |
| `empty`    | `end()`                                                |

```ts
app.get('/invoices/:id/pdf').handle(async (_request, { params }, response) => {
  const pdf = await renderInvoice(params.id)

  if (!pdf) {
    return response.status(404).json({ error: 'not found' })
  }

  response.header('cache-control', 'no-store').status(200).send(pdf)
})
```

`response.json(body)` and `response.send(body)` are available when `200` is declared as json. They answer with the status set before, else with `200`. When a stream fails, the error is forwarded to the error handlers of the application. Before the first byte they can still answer, afterwards the connection is closed and they can only observe the error.

`response.raw` is the native express response for everything else, e.g. `response.raw.redirect(302, '/elsewhere')`. It is untyped and does not check the declared responses. Middlewares keep receiving the native response.

## Clients

`HTTPResponse` is a discriminated union over the declared statuses. Declared statuses resolve, whether they are successful or not, all others reject:

```ts
const invoice = await client.get('/invoices/:id', { params: { id } })

if (invoice.statusCode === 404) {
  console.warn(invoice.data.error)
} else {
  console.log(invoice.data.id)
}
```

`data` is the json body, a string for `text`, an `ArrayBuffer` for `binary` and `undefined` for `empty`.

`data` of an empty body of a json status is `undefined`. Generic helpers handling the responses of any route use `AnyHTTPResponse`.

A custom `HTTPAdapter` receives the `responses` of the route as last argument of `request`, after the request config, and has to resolve the declared statuses and reject all others itself. `isDeclaredStatus` and `decodeBody` of `@t-rest/client` implement this:

```ts
import {
  decodeBody,
  HTTPAdapter,
  HTTPResponse,
  isDeclaredStatus,
} from '@t-rest/client'

class FetchHTTPAdapter implements HTTPAdapter {
  async request<TResponses extends ResponseMap>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    requestConfig: RequestConfig | undefined,
    responses: TResponses
  ) {
    const response = await fetch(url, {
      method,
      headers: requestConfig?.headers as Record<string, string>,
      body: data === undefined ? undefined : JSON.stringify(data),
    })

    if (!isDeclaredStatus(responses, response.status)) {
      throw new Error(`Request failed with status code ${response.status}`)
    }

    return {
      data: decodeBody(
        await response.arrayBuffer(),
        responses[response.status]
      ),
      statusCode: response.status,
    } as HTTPResponse<TResponses>
  }
}
```

The supertest adapter types `body` by `status` in the same way. Bodies of `binary` statuses are `Buffer`s, `empty` statuses have an empty object as body. Generic helpers use `AnySupertestResponse`.
