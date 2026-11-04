import { BagOfRoutes, json, Route, text } from '@t-rest/core'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { build, codes, golden } from './golden.js'

const Product = z
  .object({ id: z.number(), name: z.string() })
  .meta({ id: 'Product' })

const bag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/products')
      .validate(z.object({ body: z.object({ name: z.string().min(1) }) }), {
        examples: {
          valid: { summary: 'A product', value: { body: { name: 'Chair' } } },
          invalid: { value: { body: { name: '' } } },
        },
      })
      .responses({
        201: json(Product, {
          examples: {
            created: { value: { id: 1, name: 'Chair' } },
            wrong: { value: { id: 'one', name: 'Chair' } as never },
          },
        }),
        200: text('text/plain', { examples: { plain: { value: 'ok' } } }),
      })
  )
  .addRoute(
    Route.get('/products/:id').responses({
      200: json(
        z.object({ id: z.number(), tags: z.array(z.string()).default([]) }),
        { examples: { tagged: { value: { id: 1, tags: [] } } } }
      ),
      404: json<{ error: string }>({
        examples: { missing: { value: { error: 'not found' } } },
      }),
    })
  )
  .build()

describe('examples', () => {
  test('valid request examples document the body, invalid ones are reported and left out', async () => {
    const result = build(bag)
    const body = result.operation('POST /products').requestBody

    expect(body?.content['application/json'].examples).toEqual({
      valid: { summary: 'A product', value: { name: 'Chair' } },
    })
    expect(codes(result)).toContainEqual({
      code: 'operation/example-invalid',
      at: { operation: 'POST /products', slot: 'request' },
      data: {
        example: 'invalid',
        issues: [
          'body.name: Too small: expected string to have >=1 characters',
        ],
      },
    })
    await golden(result.model, 'examples')
  })

  test('response examples are validated when the schema reads the same in both directions', () => {
    const result = build(bag)
    const created = result.operation('POST /products').responses['201']

    expect(created).toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          content: {
            'application/json': {
              shape: { kind: 'ref', target: 'output:Product' },
              examples: { created: { value: { id: 1, name: 'Chair' } } },
            },
          },
        }),
      })
    )
    expect(codes(result)).toContainEqual({
      code: 'operation/example-invalid',
      at: { operation: 'POST /products', slot: 'response 201' },
      data: {
        example: 'wrong',
        issues: ['id: Invalid input: expected number, received string'],
      },
    })
  })

  test('response examples of a schema with a readonly field are validated', () => {
    const result = build(
      BagOfRoutes.withoutVersioning()
        .addRoute(
          Route.get('/tickets').responses({
            200: json(z.object({ id: z.string().readonly() }), {
              examples: {
                valid: { value: { id: 't-1' } },
                wrong: { value: { id: 1 } as never },
              },
            }),
          })
        )
        .build()
    )
    const ok = result.operation('GET /tickets').responses['200']

    expect(
      ok.kind === 'inline' && ok.response.content['application/json'].examples
    ).toEqual({ valid: { value: { id: 't-1' } } })
    expect(codes(result)).toEqual([
      {
        code: 'operation/example-invalid',
        at: { operation: 'GET /tickets', slot: 'response 200' },
        data: {
          example: 'wrong',
          issues: ['id: Invalid input: expected string, received number'],
        },
      },
    ])
  })

  test('examples of a schema that differs between directions, or of no schema, are kept unverified', () => {
    const result = build(bag)
    const responses = result.operation('GET /products/{}').responses
    const examplesOf = (status: string) => {
      const slot = responses[status]
      return slot.kind === 'inline'
        ? slot.response.content['application/json'].examples
        : undefined
    }

    expect(examplesOf('200')).toEqual({
      tagged: { value: { id: 1, tags: [] } },
    })
    expect(examplesOf('404')).toEqual({
      missing: { value: { error: 'not found' } },
    })
    expect(
      codes(result).filter(
        ({ code }) => code === 'operation/example-unverifiable'
      )
    ).toEqual([
      {
        code: 'operation/example-unverifiable',
        at: { operation: 'GET /products/{}', slot: 'response 200' },
        data: {
          examples: ['tagged'],
          reason: 'the schema reads differently as input and as output',
        },
      },
      {
        code: 'operation/example-unverifiable',
        at: { operation: 'GET /products/{}', slot: 'response 404' },
        data: { examples: ['missing'], reason: 'the descriptor has no schema' },
      },
    ])
  })

  test('text examples are documented as written', () => {
    const plain = build(bag).operation('POST /products').responses['200']

    expect(plain).toEqual({
      kind: 'inline',
      response: {
        description: 'OK',
        headers: [],
        content: {
          'text/plain': {
            shape: { kind: 'string' },
            examples: { plain: { value: 'ok' } },
          },
        },
      },
    })
  })
})
