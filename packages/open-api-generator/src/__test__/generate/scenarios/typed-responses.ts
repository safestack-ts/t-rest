import { BagOfRoutes, binary, empty, json, Route, text } from '@t-rest/core'

type Invoice = {
  id: number
}

type Failure = {
  error: string
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/invoices').responses({
      200: json<Invoice>(),
      404: json<Failure>(),
    })
  )
  .addRoute(
    Route.get('/invoices/pdf').responses({
      200: binary('application/pdf'),
      404: json<Failure>(),
    })
  )
  .addRoute(
    Route.get('/invoices/csv').responses({
      200: text('text/csv'),
      201: text(),
    })
  )
  .addRoute(Route.delete('/invoices').responses({ 204: empty() }))
  .addRoute(Route.get('/shorthand').response<Invoice>())
  .build()
