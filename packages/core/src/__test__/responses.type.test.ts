import { AssertTrue, IsExact } from 'conditional-type-checks'
import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { Route } from '../classes/core/route.js'
import { RouteDef } from '../classes/core/route-def.js'
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

// a union of routes keeps the statuses and bodies of every member
const unionA = Route.get('/a').responses({ 200: json<Invoice>() })
const unionB = Route.get('/b').responses({
  201: json<{ created: boolean }>(),
  404: json<Failure>(),
})
const unionC = Route.get('/c').responses({ 200: text('text/csv') })
type UnionRoute = typeof unionA | typeof unionB | typeof unionC
const unionBag = BagOfRoutes.withoutVersioning()
  .addRoute(unionA)
  .addRoute(unionB)
  .build()

type _unionDeclaredStatus = AssertTrue<
  IsExact<DeclaredStatus<UnionRoute>, 200 | 201 | 404>
>
type _unionBodyOf = AssertTrue<
  IsExact<BodyOf<UnionRoute>, Invoice | { created: boolean } | Failure | string>
>
type _unionBodyOfStatus = AssertTrue<
  IsExact<BodyOf<UnionRoute, 200>, Invoice | string>
>
type _unionBodyOfMemberStatus = AssertTrue<
  IsExact<BodyOf<UnionRoute, 201>, { created: boolean }>
>
type _unionRouteOutput = AssertTrue<
  IsExact<
    RouteOutput<typeof unionBag, 'GET', '/a' | '/b'>,
    Invoice | { created: boolean } | Failure
  >
>

// the shorthand takes the status of a successful response
const created = Route.post('/').response<Invoice>(201)
type _shorthandCreated = AssertTrue<
  IsExact<
    (typeof created)['~responses'],
    { 201: JsonResponseDescriptor<Invoice> }
  >
>
const accepted = Route.post('/').validate(null).response<Invoice>(202)
type _shorthandAccepted = AssertTrue<
  IsExact<
    (typeof accepted)['~responses'],
    { 202: JsonResponseDescriptor<Invoice> }
  >
>
const noContent = Route.delete('/').metaData({}).response(204)
type _shorthandNoContent = AssertTrue<
  IsExact<(typeof noContent)['~responses'], { 204: EmptyResponseDescriptor }>
>
// @ts-expect-error other statuses are declared with .responses()
Route.get('/').response<Invoice>(404)
// @ts-expect-error a 204 response has no body
Route.get('/').response<Invoice>(204)

// the output of single statuses of a route
type _routeOutputOfStatus = AssertTrue<
  IsExact<RouteOutput<typeof bag, 'GET', '/many', '', 200>, Invoice>
>
type _routeOutputOfErrorStatus = AssertTrue<
  IsExact<RouteOutput<typeof bag, 'GET', '/many', '', 404>, Failure>
>

// hand written route definitions declare their responses as a response map
type _invalidRouteDef = RouteDef<
  '',
  'GET',
  '/',
  null,
  // @ts-expect-error the responses are a map of descriptors by status
  Invoice,
  unknown
>

// a status enum member counts as its value
enum StatusCodes {
  CREATED = 201,
}
const createdByEnum = Route.post('/').response<Invoice>(StatusCodes.CREATED)
type _shorthandByEnum = AssertTrue<
  IsExact<DeclaredStatus<typeof createdByEnum>, 201>
>
