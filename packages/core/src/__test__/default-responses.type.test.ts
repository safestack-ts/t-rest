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
} from '../types/response-descriptor.js'
import { RouteOutput } from '../types/route-input-output.js'
import { json } from '../utils/response-descriptors.js'

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

// @ts-expect-error defaults are descriptors by status
bag.withDefaultResponses({ 400: 'json' })
