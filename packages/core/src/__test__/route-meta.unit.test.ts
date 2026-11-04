import { expect, test } from 'vitest'
import { z } from 'zod'
import { Route } from '../classes/core/route.js'
import { json } from '../utils/response-descriptors.js'
import { securityScheme } from '../utils/security-scheme.js'

test('security schemes carry their name and spec', () => {
  const spec = { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } as const

  expect(securityScheme('bearer', spec)).toMatchObject({
    name: 'bearer',
    spec,
  })
})

test('scopes() requests a scheme with scopes', () => {
  const oauth = securityScheme('oauth', {
    type: 'oauth2',
    flows: {
      clientCredentials: {
        tokenUrl: '/token',
        scopes: { 'read:me': 'Read the profile' },
      },
    },
  })

  expect(oauth.scopes('read:me')).toEqual({
    scheme: oauth,
    scopes: ['read:me'],
  })
})

test('request examples of .validate() are kept along every builder chain', () => {
  const Params = z.object({ params: z.object({ id: z.string() }) })
  const examples = { ada: { value: { params: { id: 'ada' } } } }
  const meta = { summary: 'Get a person' }

  const routes = [
    Route.get('/:id').validate(Params, { examples }).response(),
    Route.get('/:id').validate(Params, { examples }).metaData(meta).response(),
    Route.get('/:id').metaData(meta).validate(Params, { examples }).response(),
    Route.get('/:id')
      .metaData(meta)
      .validate(Params, { examples })
      .responses({ 200: json() }),
  ]

  for (const route of routes) {
    expect(route.requestExamples).toBe(examples)
  }
})

test('routes without request examples have none', () => {
  expect(Route.get('/').response().requestExamples).toBeUndefined()
  expect(
    Route.get('/').validate(z.object({})).response().requestExamples
  ).toBeUndefined()
})
