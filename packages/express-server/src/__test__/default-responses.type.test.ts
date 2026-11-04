import {
  BagOfRoutes,
  DeclaredStatus,
  ExtractRoute,
  json,
  JsonResponseDescriptor,
  Route,
  TextResponseDescriptor,
} from '@t-rest/core'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import Express from 'express'
import { TypedExpressApplication } from '../classes/typed-express-application.js'

type Invoice = { id: number }
type Invalid = { issues: string[] }

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/invoices/:id').response<Invoice>())
  .build()
  .withDefaultResponses({ 400: json<Invalid>() })

type _defaultStatusDeclared = AssertTrue<
  IsExact<
    DeclaredStatus<ExtractRoute<typeof bagOfRoutes, 'GET', '/invoices/:id'>>,
    200 | 400
  >
>

const app = TypedExpressApplication.withoutVersioning(Express(), bagOfRoutes)

app.get('/invoices/:id').handle((_request, _validation, response) => {
  response.status(400).json({ issues: ['id'] })
  // @ts-expect-error the default status takes the default body
  response.status(400).json({ id: 1 })
  // @ts-expect-error status is not declared
  response.status(404)
  response.status(200).json({ id: 1 })
})

declare const unionDefaults:
  | { 400: JsonResponseDescriptor<Invalid> }
  | { 404: TextResponseDescriptor }
const unionApp = TypedExpressApplication.withoutVersioning(
  Express(),
  BagOfRoutes.withoutVersioning()
    .addRoute(Route.get('/invoices/:id').response<Invoice>())
    .build()
    .withDefaultResponses(unionDefaults)
)

unionApp.get('/invoices/:id').handle((_request, _validation, response) => {
  response.status(400).json({ issues: ['id'] })
  response.status(404).send('missing')
  // @ts-expect-error a default status takes its own body
  response.status(400).json({ id: 1 })
  response.status(200).json({ id: 1 })
})
