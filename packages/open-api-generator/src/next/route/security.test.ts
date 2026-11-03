import { BagOfRoutes, Route, securityScheme } from '@t-rest/core'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { build, codes, golden } from './golden.js'

const bearer = securityScheme('bearer', { type: 'http', scheme: 'bearer' })
const apiKey = securityScheme('apiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'X-Api-Key',
})
const oauth = securityScheme('oauth', {
  type: 'oauth2',
  flows: {
    clientCredentials: {
      tokenUrl: 'https://auth.example.com/token',
      scopes: { read: 'Read access' },
    },
  },
})

const headerNames = (parameters: readonly { name: string; in: string }[]) =>
  parameters.filter((p) => p.in === 'header').map((p) => p.name)

describe('security', () => {
  const bag = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/required')
        .validate(
          z.object({
            headers: z.object({
              authorization: z.string(),
              'x-trace': z.string(),
            }),
          })
        )
        .response(204)
    )
    .addRoute(
      Route.get('/optional')
        .validate(
          z.object({
            headers: z.object({ Authorization: z.string().optional() }),
          })
        )
        .response(204)
    )
    .addRoute(Route.get('/default').response(204))
    .addRoute(
      Route.get('/public')
        .validate(
          z.object({ headers: z.object({ authorization: z.string() }) })
        )
        .metaData({ security: [] })
        .response(204)
    )
    .addRoute(
      Route.get('/scoped')
        .metaData({ security: [[oauth.scopes('read')], []] })
        .response(204)
    )
    .build()
  const config = {
    security: [[apiKey]],
    securityFromHeaders: { authorization: bearer },
  }

  test('a required bridged header is required security, the header is removed', async () => {
    const result = build(bag, config)
    const operation = result.operation('GET /required')

    expect(operation.security).toEqual([[{ scheme: 'bearer', scopes: [] }]])
    expect(headerNames(operation.parameters)).toEqual(['x-trace'])
    await golden(result.model, 'security-bridge')
  })

  test('an optional bridged header is optional security', () => {
    const operation = build(bag, config).operation('GET /optional')

    expect(operation.security).toEqual([[{ scheme: 'bearer', scopes: [] }], []])
    expect(headerNames(operation.parameters)).toEqual([])
  })

  test('routes without a bridged header get the bag default', () => {
    expect(build(bag, config).operation('GET /default').security).toEqual([
      [{ scheme: 'apiKey', scopes: [] }],
    ])
  })

  test('meta.security wins over the bridge and keeps uncovered headers', () => {
    const operation = build(bag, config).operation('GET /public')

    expect(operation.security).toEqual([])
    expect(headerNames(operation.parameters)).toEqual(['authorization'])
  })

  test('meta.security keeps scopes and documents every scheme in use', () => {
    const result = build(bag, config)

    expect(result.operation('GET /scoped').security).toEqual([
      [{ scheme: 'oauth', scopes: ['read'] }],
      [],
    ])
    expect(result.model.securitySchemes).toEqual({
      apiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
      bearer: { type: 'http', scheme: 'bearer' },
      oauth: oauth.spec,
    })
    expect(codes(result)).toEqual([])
  })

  test('no security anywhere is public', () => {
    expect(build(bag).operation('GET /default').security).toEqual([])
  })

  test('a header and the scheme that sends it are reported and the header removed', async () => {
    const both = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/keys')
          .validate(
            z.object({ headers: z.object({ 'x-api-key': z.string() }) })
          )
          .metaData({ security: [[apiKey]] })
          .response(204)
      )
      .build()
    const result = build(both)

    expect(headerNames(result.operation('GET /keys').parameters)).toEqual([])
    expect(codes(result)).toEqual([
      {
        code: 'security/header-and-scheme',
        at: {
          operation: 'GET /keys',
          slot: 'request',
          pointer: '/properties/headers',
        },
        data: { header: 'x-api-key', scheme: 'apiKey' },
      },
    ])
    await golden(result.model, 'header-and-scheme')
  })

  test('global headers covered by a scheme in effect are removed', () => {
    const result = build(bag, {
      ...config,
      headers: z.object({ authorization: z.string(), 'x-tenant': z.string() }),
    })

    expect(headerNames(result.operation('GET /default').parameters)).toEqual([
      'authorization',
      'x-tenant',
    ])
    expect(headerNames(result.operation('GET /optional').parameters)).toEqual([
      'x-tenant',
    ])
  })

  test('two schemes with one name and different specs are reported', () => {
    const other = securityScheme('bearer', {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
    const same = securityScheme('bearer', { type: 'http', scheme: 'bearer' })
    const conflicting = BagOfRoutes.withoutVersioning()
      .addRoute(
        Route.get('/a')
          .metaData({ security: [[bearer]] })
          .response(204)
      )
      .addRoute(
        Route.get('/b')
          .metaData({ security: [[same]] })
          .response(204)
      )
      .addRoute(
        Route.get('/c')
          .metaData({ security: [[other]] })
          .response(204)
      )
      .build()

    expect(codes(build(conflicting))).toEqual([
      {
        code: 'security/scheme-name-conflict',
        at: { operation: 'GET /c' },
        data: { name: 'bearer' },
      },
    ])
  })
})
