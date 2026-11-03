import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import type { StandardJSONSchemaSource } from './convert.js'
import { readRequest, RequestRoute } from './read-request.js'
import { createReaderRun } from './read-schema.js'

const route: RequestRoute = {
  operation: 'POST /users/{}/files/{}',
  path: '/users/:userId/files/:fileId',
}
const read = (
  validator: StandardJSONSchemaSource,
  overrides: Partial<RequestRoute> = {}
) => readRequest(validator, { ...route, ...overrides }, createReaderRun())

const string = { kind: 'string' } as const

describe('readRequest', () => {
  test('splits the validator into params, query, headers and body', () => {
    const result = read(
      z.object({
        params: z.object({ fileId: z.uuid(), userId: z.string() }),
        query: z.object({ dryRun: z.string().optional() }),
        headers: z.object({ 'x-trace': z.string() }),
        body: z.object({ name: z.string() }),
      })
    )

    expect(result).toEqual({
      params: [
        { name: 'userId', required: true, shape: string },
        {
          name: 'fileId',
          required: true,
          shape: expect.objectContaining({ kind: 'string', format: 'uuid' }),
        },
      ],
      query: {
        kind: 'object',
        fields: [{ name: 'dryRun', required: false, shape: string }],
      },
      headers: {
        kind: 'object',
        fields: [{ name: 'x-trace', required: true, shape: string }],
      },
      body: {
        required: true,
        shape: {
          kind: 'object',
          fields: [{ name: 'name', required: true, shape: string }],
        },
      },
      types: {},
      diagnostics: [],
    })
  })

  test('derives path params the validator omits from the pattern as strings', () => {
    expect(
      read(z.object({ params: z.object({ fileId: z.uuid() }) })).params.map(
        ({ name, shape }) => [name, shape.kind]
      )
    ).toEqual([
      ['userId', 'string'],
      ['fileId', 'string'],
    ])
    expect(read(z.object({})).params).toEqual([
      { name: 'userId', required: true, shape: string },
      { name: 'fileId', required: true, shape: string },
    ])
  })

  test('marks an optional body as not required', () => {
    expect(
      read(z.object({ body: z.object({ a: z.string() }).optional() })).body
        ?.required
    ).toBe(false)
  })

  test('dereferences a validator with an id', () => {
    const result = read(
      z.object({ body: z.object({ a: z.string() }) }).meta({ id: 'CreateFile' })
    )
    expect(result.body?.shape).toEqual({
      kind: 'object',
      fields: [{ name: 'a', required: true, shape: string }],
    })
  })

  test('reports other top-level keys, except multipart file fields', () => {
    const validator = z.object({
      body: z.object({}),
      extra: z.string(),
      avatar: z.string(),
    })
    const result = read(validator, { multipartFiles: ['avatar'] })

    expect(
      result.diagnostics.map(({ code, at, data }) => ({ code, at, data }))
    ).toEqual([
      {
        code: 'schema/unknown-request-slot',
        at: {
          operation: route.operation,
          slot: 'request',
          pointer: '/properties/extra',
        },
        data: { key: 'extra' },
      },
    ])
  })

  test('escapes the key in the pointer of an unknown slot', () => {
    const result = read(z.object({ 'a/b~c': z.string() }))

    expect(result.diagnostics.map(({ at }) => at.pointer)).toEqual([
      '/properties/a~1b~0c',
    ])
  })

  test('reports a validator whose root is not an object', () => {
    const validator = z.union([
      z.object({ body: z.object({ a: z.string() }) }),
      z.object({ query: z.object({ b: z.string() }) }),
    ])
    const result = read(validator, { path: '/search' })

    expect(result).toEqual({
      params: [],
      types: {},
      diagnostics: [
        expect.objectContaining({
          code: 'schema/request-not-object',
          at: { operation: route.operation, slot: 'request', pointer: '' },
          data: { kind: 'union' },
        }),
      ],
    })
  })

  test('reads a t-rest validator without slots', () => {
    const empty: StandardJSONSchemaSource = {
      '~standard': {
        vendor: 't-rest',
        jsonSchema: {
          input: () => ({ type: 'object' }),
          output: () => ({ type: 'object' }),
        },
      },
    }
    expect(read(empty, { path: '/health' })).toEqual({
      params: [],
      types: {},
      diagnostics: [],
    })
  })
})
