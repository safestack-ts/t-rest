import { binary, empty, json, Route, text } from '@t-rest/core'
import { StatusCodes } from 'http-status-codes'
import { TypedResponse } from '../types/typed-response.js'

type Invoice = { id: number }
type Failure = { error: string }

const invoiceRoute = Route.get('/invoices/:id').responses({
  200: json<Invoice>(),
  404: json<Failure>(),
})
const pdfRoute = Route.get('/invoices/:id/pdf').responses({
  200: binary('application/pdf'),
  201: text('text/csv'),
  204: empty(),
  404: json<Failure>(),
})
const createRoute = Route.post('/invoices').responses({ 201: json<Invoice>() })
const enumKeyRoute = Route.get('/').responses({
  [StatusCodes.OK]: json<Invoice>(),
})

declare const invoice: TypedResponse<typeof invoiceRoute>
declare const pdf: TypedResponse<typeof pdfRoute>
declare const create: TypedResponse<typeof createRoute>
declare const enumKey: TypedResponse<typeof enumKeyRoute>
declare const buffer: Buffer
declare const stream: NodeJS.ReadableStream

// bodies are typed by status
invoice.status(200).json({ id: 1 })
invoice.status(404).json({ error: 'not found' })
invoice.json({ id: 1 })
invoice.status(StatusCodes.OK).json({ id: 1 })
invoice.status(StatusCodes.NOT_FOUND).json({ error: 'not found' })
enumKey.status(200).json({ id: 1 })
enumKey.status(StatusCodes.OK).json({ id: 1 })
invoice.header('x-id', '1').status(200).json({ id: 1 })
invoice.raw.setHeader('x-id', '1')

// @ts-expect-error status is not declared
invoice.status(201)
// @ts-expect-error status is not declared
invoice.status(StatusCodes.CREATED)
// @ts-expect-error body of another status
invoice.status(404).json({ id: 1 })
// @ts-expect-error body of another status
invoice.status(200).json({ error: 'not found' })
// @ts-expect-error body of another status
invoice.json({ error: 'not found' })

// methods are selected by the descriptor kind
pdf.status(200).send(buffer)
pdf.status(200).send(new Uint8Array(1))
pdf.status(200).stream(stream)
pdf.status(200).file('/invoice.pdf')
pdf.status(201).send('a,b')
pdf.status(204).end()
pdf.status(404).json({ error: 'not found' })

// @ts-expect-error json on a binary status
pdf.status(200).json({ id: 1 })
// @ts-expect-error a binary status does not accept strings
pdf.status(200).send('pdf')
// @ts-expect-error a text status does not accept binary bodies
pdf.status(201).send(buffer)
// @ts-expect-error a text status cannot be streamed
pdf.status(201).stream(stream)
// @ts-expect-error an empty status has no body methods
pdf.status(204).send('')
// @ts-expect-error a json status has no end
pdf.status(404).end()

// @ts-expect-error json without status needs 200 to be declared as json
pdf.json({ id: 1 })
// @ts-expect-error json without status needs 200 to be declared
create.json({ id: 1 })
create.status(201).json({ id: 1 })
