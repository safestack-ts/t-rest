import {
  BagOfRoutes,
  HTTPMethod,
  binary,
  empty,
  json,
  ResponseMap,
  Route,
  text,
} from '@t-rest/core'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import { AxiosHTTPAdapter } from '../classes/axios-http-adapter.js'
import { RESTClient } from '../classes/rest-client.js'
import { HTTPAdapter } from '../types/http-adapter.js'
import {
  AnyHTTPResponse,
  HTTPResponse,
  HTTPResponseHeaders,
} from '../types/http-response.js'

type Invoice = { id: number }
type Failure = { error: string }

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/invoices/:id')
      .validate(z.object({ params: z.object({ id: z.string() }) }))
      .responses({
        200: json<Invoice>(),
        404: json<Failure>(),
      })
  )
  .addRoute(
    Route.get('/pdf').responses({
      200: binary('application/pdf'),
      201: text('text/csv'),
      204: empty(),
      404: json<Failure>(),
    })
  )
  .addRoute(Route.get('/single').response<Invoice>())
  .addRoute(
    Route.get('/schema').responses({
      200: json(z.object({ id: z.string().transform(Number) })),
      404: json<Failure>(),
    })
  )
  .build()

const client = RESTClient.withoutVersioning(bagOfRoutes, null as any)

type Invalid = { issues: string[] }
const clientWithDefaults = RESTClient.withoutVersioning(
  bagOfRoutes.withDefaultResponses({ 400: json<Invalid>() }),
  null as any
)

export const test = async () => {
  const invoice = await client.get('/invoices/:id', {
    params: { id: '1' },
  })

  type _statusCode = AssertTrue<IsExact<typeof invoice.statusCode, 200 | 404>>

  if (invoice.statusCode === 200) {
    type _data = AssertTrue<IsExact<typeof invoice.data, Invoice>>
  } else {
    type _data = AssertTrue<IsExact<typeof invoice.data, Failure>>
  }

  const pdf = await client.get('/pdf')

  switch (pdf.statusCode) {
    case 200: {
      type _data = AssertTrue<IsExact<typeof pdf.data, ArrayBuffer>>
      break
    }
    case 201: {
      type _data = AssertTrue<IsExact<typeof pdf.data, string>>
      break
    }
    case 204: {
      type _data = AssertTrue<IsExact<typeof pdf.data, undefined>>
      break
    }
    case 404: {
      type _data = AssertTrue<IsExact<typeof pdf.data, Failure>>
      break
    }
  }

  const single = await client.get('/single')

  type _single = AssertTrue<
    IsExact<
      typeof single,
      { data: Invoice; statusCode: 200; headers?: HTTPResponseHeaders }
    >
  >

  type _headers = AssertTrue<
    IsExact<typeof pdf.headers, HTTPResponseHeaders | undefined>
  >

  const schema = await client.get('/schema')

  if (schema.statusCode === 200) {
    // the body of a schema is its output
    type _data = AssertTrue<IsExact<typeof schema.data, { id: number }>>
  } else {
    type _data = AssertTrue<IsExact<typeof schema.data, Failure>>
  }

  // @ts-expect-error status is not declared
  invoice.statusCode === 500

  const withDefaults = await clientWithDefaults.get('/invoices/:id', {
    params: { id: '1' },
  })

  type _defaultStatus = AssertTrue<
    IsExact<typeof withDefaults.statusCode, 200 | 400 | 404>
  >
  if (withDefaults.statusCode === 400) {
    type _data = AssertTrue<IsExact<typeof withDefaults.data, Invalid>>
  }
  // @ts-expect-error status is not declared
  withDefaults.statusCode === 500
}

// helpers handling the responses of any route
type _unknownResponses = AssertTrue<
  IsExact<HTTPResponse<unknown>, AnyHTTPResponse>
>
type _anyResponses = AssertTrue<IsExact<HTTPResponse<any>, AnyHTTPResponse>>
type _responseMap = AssertTrue<
  IsExact<HTTPResponse<ResponseMap>, AnyHTTPResponse>
>

// the response of every route is an AnyHTTPResponse
export const anyResponse = async (): Promise<AnyHTTPResponse> =>
  client.get('/pdf')

// axios responses always carry headers
type _headersOnAxiosAdapter = AssertTrue<
  IsExact<
    Awaited<ReturnType<AxiosHTTPAdapter['request']>>['headers'],
    HTTPResponseHeaders
  >
>

// custom adapters returning no headers stay valid
export class AdapterWithoutHeaders implements HTTPAdapter {
  async request<TResponses extends ResponseMap>(
    _method: HTTPMethod,
    _url: string,
    data: unknown
  ): Promise<HTTPResponse<TResponses>> {
    return { data, statusCode: 200 } as HTTPResponse<TResponses>
  }
}
