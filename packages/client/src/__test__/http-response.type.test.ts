import { BagOfRoutes, binary, empty, json, Route, text } from '@t-rest/core'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import { RESTClient } from '../classes/rest-client.js'

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
  .build()

const client = RESTClient.withoutVersioning(bagOfRoutes, null as any)

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
    IsExact<typeof single, { data: Invoice; statusCode: 200 }>
  >

  // @ts-expect-error status is not declared
  invoice.statusCode === 500
}
