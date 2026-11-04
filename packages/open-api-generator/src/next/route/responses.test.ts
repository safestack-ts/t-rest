import { BagOfRoutes, binary, empty, json, Route } from '@t-rest/core'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { build, codes, golden } from './golden.js'

const Upload = z
  .object({ id: z.string(), size: z.number() })
  .meta({ id: 'Upload' })

describe('responses', () => {
  const Failure = z.object({ error: z.string() }).meta({ id: 'Failure' })
  const badRequest = json(Failure, {
    id: 'BadRequest',
    description: 'The request is invalid',
  })

  test('descriptors document their kind, description or reason phrase', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/files/:id').responses({
          200: binary('application/pdf', { description: 'The file' }),
          204: empty(),
          404: json(Failure),
        })
      )
      .build()

    expect(build(bag).operation('GET /files/{}').responses).toEqual({
      200: {
        kind: 'inline',
        response: {
          description: 'The file',
          headers: [],
          content: {
            'application/pdf': {
              shape: { kind: 'string', contentMediaType: 'application/pdf' },
            },
          },
        },
      },
      204: {
        kind: 'inline',
        response: { description: 'No Content', headers: [], content: {} },
      },
      404: {
        kind: 'inline',
        response: {
          description: 'Not Found',
          headers: [],
          content: {
            'application/json': {
              shape: { kind: 'ref', target: 'output:Failure' },
            },
          },
        },
      },
    })
  })

  test('default responses with an id are one shared response', async () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/a').responses({ 200: json(Upload) }))
      .addRoute(
        Route.post('/b').responses({ 201: json(Upload), 400: json(Failure) })
      )
      .build()
      .withDefaultResponses({ 400: badRequest })
    const result = build(bag)

    expect(result.operation('GET /a').responses['400']).toEqual({
      kind: 'shared',
      id: 'BadRequest',
    })
    expect(result.operation('POST /b').responses['400']).toEqual(
      expect.objectContaining({ kind: 'inline' })
    )
    expect(result.model.responses).toEqual({
      BadRequest: {
        description: 'The request is invalid',
        headers: [],
        content: {
          'application/json': {
            shape: { kind: 'ref', target: 'output:Failure' },
          },
        },
      },
    })
    await golden(result.model, 'default-responses')
  })

  test('one id on different descriptors is inlined and reported', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/a').responses({ 400: badRequest }))
      .addRoute(
        Route.get('/b').responses({
          400: json(Failure, { id: 'BadRequest', description: 'Other' }),
        })
      )
      .build()
    const result = build(bag)

    expect(result.model.responses).toEqual({})
    expect(codes(result)).toEqual([
      {
        code: 'naming/duplicate-response-id',
        at: { operation: 'GET /b', slot: 'response 400' },
        data: { id: 'BadRequest' },
      },
    ])
  })

  test('a shared response under two statuses without a description is reported', () => {
    const failure = json(Failure, { id: 'Failure' })
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/a').responses({ 400: failure, 404: failure }))
      .addRoute(Route.get('/b').responses({ 400: failure }))
      .build()
    const result = build(bag)

    expect(result.model.responses.Failure?.description).toBe(
      'Bad Request or Not Found'
    )
    expect(codes(result)).toEqual([
      {
        code: 'naming/shared-response-without-description',
        at: { operation: 'GET /a', slot: 'response 400' },
        data: { id: 'Failure', statuses: ['400', '404'] },
      },
    ])
  })

  test('a shared response under one status takes its reason phrase', () => {
    const failure = json(Failure, { id: 'Failure' })
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/a').responses({ 404: failure }))
      .addRoute(Route.get('/b').responses({ 404: failure }))
      .build()
    const result = build(bag)

    expect(result.model.responses.Failure?.description).toBe('Not Found')
    expect(codes(result)).toEqual([])
  })

  test('ids named like Object.prototype keys are shared responses', () => {
    const ids = ['constructor', 'toString']
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/a').responses({
          400: json(Failure, { id: 'constructor' }),
          404: json(Failure, { id: 'toString' }),
        })
      )
      .build()
    const result = build(bag)

    expect(Object.keys(result.model.responses)).toEqual(ids)
    expect(Object.values(result.operation('GET /a').responses)).toEqual(
      ids.map((id) => ({ kind: 'shared', id }))
    )
    expect(codes(result)).toEqual([])
  })

  test('the id __proto__ is reported and the response inlined', () => {
    const reserved = json(Failure, { id: '__proto__' })
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/a').responses({ 400: reserved }))
      .addRoute(Route.get('/b').responses({ 400: reserved }))
      .build()
    const result = build(bag)

    expect(Object.keys(result.model.responses)).toEqual([])
    expect(result.operation('GET /b').responses['400']).toEqual(
      expect.objectContaining({ kind: 'inline' })
    )
    expect(codes(result)).toEqual([
      {
        code: 'naming/reserved-response-id',
        at: { operation: 'GET /a', slot: 'response 400' },
        data: { id: '__proto__' },
      },
    ])
  })

  test('json<T>() without schema is any JSON value', () => {
    const bag = BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/legacy').responses({ 200: json<{ a: string }>() }))
      .build()
    const result = build(bag)

    expect(result.operation('GET /legacy').responses['200']).toEqual({
      kind: 'inline',
      response: {
        description: 'OK',
        headers: [],
        content: { 'application/json': { shape: { kind: 'unknown' } } },
      },
    })
    expect(codes(result)).toEqual([
      {
        code: 'response/untyped-json',
        at: { operation: 'GET /legacy', slot: 'response 200' },
        data: {},
      },
    ])
  })
})
