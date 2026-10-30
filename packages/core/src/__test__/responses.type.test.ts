import { AssertTrue, IsExact } from 'conditional-type-checks'
import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { Route } from '../classes/core/route.js'
import {
  BinaryResponseDescriptor,
  BodyOf,
  DeclaredStatus,
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  TextResponseDescriptor,
} from '../types/response-descriptor.js'
import { RouteOutput } from '../types/route-input-output.js'
import { binary, empty, json, text } from '../utils/response-descriptors.js'

type Invoice = { id: number }
type Failure = { error: string }

const route = Route.get('/invoices/:id').responses({
  200: json<Invoice>(),
  201: text('text/csv'),
  202: binary('application/pdf'),
  204: empty(),
  404: json<Failure>(),
})
type TestRoute = typeof route

type _responses = AssertTrue<
  IsExact<
    TestRoute['~responses'],
    {
      200: JsonResponseDescriptor<Invoice>
      201: TextResponseDescriptor<'text/csv'>
      202: BinaryResponseDescriptor<'application/pdf'>
      204: EmptyResponseDescriptor
      404: JsonResponseDescriptor<Failure>
    }
  >
>
type _declaredStatus = AssertTrue<
  IsExact<DeclaredStatus<TestRoute>, 200 | 201 | 202 | 204 | 404>
>
type _bodyOf200 = AssertTrue<IsExact<BodyOf<TestRoute, 200>, Invoice>>
type _bodyOf404 = AssertTrue<IsExact<BodyOf<TestRoute, 404>, Failure>>
type _bodyOfMany = AssertTrue<
  IsExact<BodyOf<TestRoute, 200 | 404>, Invoice | Failure>
>

const shorthand = Route.get('/').response<Invoice>()
type _shorthand = AssertTrue<
  IsExact<
    (typeof shorthand)['~responses'],
    { 200: JsonResponseDescriptor<Invoice> }
  >
>

const bag = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/single').response<Invoice>())
  .addRoute(
    Route.get('/many').responses({
      200: json<Invoice>(),
      404: json<Failure>(),
    })
  )
  .build()

type _routeOutput = AssertTrue<
  IsExact<RouteOutput<typeof bag, 'GET', '/single'>, Invoice>
>
type _routeOutputOfMany = AssertTrue<
  IsExact<RouteOutput<typeof bag, 'GET', '/many'>, Invoice | Failure>
>

// @ts-expect-error a descriptor is required for every status
Route.get('/').responses({ 200: 'json' })
