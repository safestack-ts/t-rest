import { AssertTrue, IsExact } from 'conditional-type-checks'
import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { Route } from '../classes/core/route.js'
import { Versioning } from '../enums/versioning.js'
import { AnyRouteDef } from '../types/any-route-def.js'
import { ExtractRoute, ExtractRoutes } from '../types/extract-route.js'
import { InferMetaData } from '../types/infer-meta-data.js'
import {
  BodyOf,
  DeclaredStatus,
  JsonResponseDescriptor,
  TextResponseDescriptor,
} from '../types/response-descriptor.js'
import { RouteOutput } from '../types/route-input-output.js'
import { json, text } from '../utils/response-descriptors.js'

type Invoice = { id: number }
type Invalid = { issues: string[] }
type NotFound = { missing: string }

const bag = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/invoices').response<Invoice[]>())
  .addRoute(
    Route.get('/invoices/:id')
      .metaData({ public: true })
      .responses({ 200: json<Invoice>(), 400: json<NotFound>() })
  )
  .build()
  .withDefaultResponses({ 400: json<Invalid>() })

type Routes = ExtractRoutes<typeof bag>
type List = ExtractRoute<typeof bag, 'GET', '/invoices'>
type Single = ExtractRoute<typeof bag, 'GET', '/invoices/:id'>

type _defaultStatusDeclared = AssertTrue<
  IsExact<DeclaredStatus<List>, 200 | 400>
>
type _defaultBody = AssertTrue<IsExact<BodyOf<List, 400>, Invalid>>
type _undeclaredStatus = AssertTrue<IsExact<BodyOf<List, 500>, never>>
type _routeWins = AssertTrue<IsExact<BodyOf<Single, 400>, NotFound>>
type _routeResponses = AssertTrue<
  IsExact<
    List['responses'][200 | 400],
    JsonResponseDescriptor<Invoice[]> | JsonResponseDescriptor<Invalid>
  >
>
type _anyRouteDef = AssertTrue<Routes extends AnyRouteDef ? true : false>
type _metaKept = AssertTrue<IsExact<InferMetaData<Single>, { public: boolean }>>
type _routeOutput = AssertTrue<
  IsExact<RouteOutput<typeof bag, 'GET', '/invoices'>, Invoice[] | Invalid>
>
type _routeOutputOfDefault = AssertTrue<
  IsExact<RouteOutput<typeof bag, 'GET', '/invoices/:id', '', 400>, NotFound>
>

const versioned = BagOfRoutes.withVersioning(Versioning.DATE, ['2024-01-01'])
  .addRoute(Route.version('2024-01-01').get('/').response<Invoice>())
  .build()
  .withDefaultResponses({ 400: json<Invalid>() })
type _versioned = AssertTrue<
  IsExact<RouteOutput<typeof versioned, 'GET', '/', '2024-01-01', 400>, Invalid>
>
type _versioning = AssertTrue<
  IsExact<(typeof versioned)['versioning'], Versioning.DATE>
>

// a quoted status is the same property as the number at runtime
const quoted = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/numeric').responses({
      200: json<Invoice>(),
      400: json<NotFound>(),
    })
  )
  .addRoute(
    Route.get('/quoted').responses({
      200: json<Invoice>(),
      '400': json<NotFound>(),
    })
  )
  .build()
  .withDefaultResponses({ '400': text(), '404': text() })
type Numeric = ExtractRoute<typeof quoted, 'GET', '/numeric'>
type Quoted = ExtractRoute<typeof quoted, 'GET', '/quoted'>
type _quotedDefaultRouteWins = AssertTrue<
  IsExact<Numeric['responses'][400], JsonResponseDescriptor<NotFound>>
>
type _quotedRouteWins = AssertTrue<
  IsExact<
    ExtractRoute<
      ReturnType<
        typeof quoted.withDefaultResponses<{ 400: TextResponseDescriptor }>
      >,
      'GET',
      '/quoted'
    >['responses'][400],
    JsonResponseDescriptor<NotFound>
  >
>
type _quotedStatuses = AssertTrue<
  IsExact<DeclaredStatus<Numeric | Quoted>, 200 | 400 | 404>
>
type _quotedOnlyDefault = AssertTrue<IsExact<BodyOf<Numeric, 404>, string>>

// a union of default maps installs one of them
declare const unionDefaults:
  | { 400: JsonResponseDescriptor<Invalid> }
  | { 404: TextResponseDescriptor }
const unionBag = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/').response<Invoice>())
  .addRoute(
    Route.get('/owned').responses({
      200: json<Invoice>(),
      400: json<NotFound>(),
    })
  )
  .build()
  .withDefaultResponses(unionDefaults)
type UnionRoot = ExtractRoute<typeof unionBag, 'GET', '/'>
type UnionOwned = ExtractRoute<typeof unionBag, 'GET', '/owned'>
type _unionStatuses = AssertTrue<
  IsExact<DeclaredStatus<UnionRoot>, 200 | 400 | 404>
>
type _unionBodies = AssertTrue<
  IsExact<BodyOf<UnionRoot, 400 | 404>, Invalid | string>
>
type _unionRouteWins = AssertTrue<IsExact<BodyOf<UnionOwned, 400>, NotFound>>

// @ts-expect-error defaults are descriptors by status
bag.withDefaultResponses({ 400: 'json' })
