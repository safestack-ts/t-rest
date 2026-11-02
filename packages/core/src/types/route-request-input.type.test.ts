import { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import { RouteDef } from '../classes/core/route-def.js'
import { JsonResponseDescriptor } from './response-descriptor.js'
import { Route } from '../classes/core/route.js'
import { PrefixMatchingRoutes } from './prefix-matching-routes.js'
import { RouteRequestInput } from './route-request-input.js'

const validator = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({ name: z.string() }),
  file: z.object({ originalname: z.string() }),
})

const multipartRoute = Route.post('/api/uploads/:id')
  .multipart()
  .validate(validator)
  .response<null>()

const multipartRouteWithMetaData = Route.version('2024-01-01')
  .put('/api/uploads/:id')
  .multipart()
  .metaData({ description: 'upload' })
  .validate(validator)
  .response<null>()

const jsonOrMultipartRoute = Route.patch('/api/uploads/:id')
  .multipart({ json: true })
  .validate(validator)
  .response<null>()

const jsonRoute = Route.post('/api/items').validate(validator).response<null>()

type Marker = { formData: true }

// a hand-written annotation without the body encoding describes a json route
type HandWrittenRoute = RouteDef<
  string,
  'POST',
  '/api/items',
  typeof validator,
  { 200: JsonResponseDescriptor<null> },
  unknown
>
type Params = { params: { id: string } }

type _test =
  | AssertTrue<
      IsExact<
        RouteRequestInput<typeof multipartRoute, Marker>,
        Omit<Params, never> & Marker
      >
    >
  | AssertTrue<
      IsExact<
        RouteRequestInput<typeof multipartRouteWithMetaData, Marker>,
        Omit<Params, never> & Marker
      >
    >
  | AssertTrue<
      IsExact<
        RouteRequestInput<typeof jsonRoute, Marker>,
        z.input<typeof validator>
      >
    >
  | AssertTrue<
      IsExact<
        RouteRequestInput<typeof jsonOrMultipartRoute, Marker>,
        | Omit<z.input<typeof validator>, 'file' | 'files'>
        | (Omit<Params, never> & Marker)
      >
    >
  | AssertTrue<
      IsExact<
        (typeof jsonOrMultipartRoute)['bodyEncoding'],
        'json-or-multipart'
      >
    >
  | AssertTrue<
      IsExact<
        RouteRequestInput<HandWrittenRoute, Marker>,
        z.input<typeof validator>
      >
    >
  | AssertTrue<
      IsExact<
        PrefixMatchingRoutes<typeof multipartRoute, '/api'>['bodyEncoding'],
        'multipart'
      >
    >

// @ts-expect-error GET requests never send a body
Route.get('/').multipart()

// @ts-expect-error DELETE requests never send a body
Route.version('2024-01-01').delete('/').multipart()
