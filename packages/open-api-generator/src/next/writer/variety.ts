import { BagOfRoutes, json, Route, securityScheme } from '@t-rest/core'
import { z } from 'zod'
import type { DocumentOptions } from './document.js'

// One bag that reaches every capability column and every document feature.

export const Status = z
  .enum(['active', 'archived'])
  .meta({ id: 'Status', 'x-enum-varnames': ['Active', 'Archived'] })

export const Cat = z
  .object({ type: z.literal('cat'), lives: z.int().min(0).max(9) })
  .meta({ id: 'Cat' })

export const Dog = z
  .object({ type: z.literal('dog'), good: z.boolean() })
  .meta({ id: 'Dog' })

export const Owner = z
  .object({
    name: z.string().describe('Full name'),
    nickname: z.string().nullable(),
    status: Status.nullable(),
    pet: z.discriminatedUnion('type', [Cat, Dog]).nullable(),
    favorite: Cat.describe('The favorite cat'),
    position: z.tuple([z.string(), z.number()]),
    score: z.number().gt(0).lte(100),
    level: z.literal(3),
    code: z.union([z.literal('a'), z.literal(1)]),
    labels: z.record(z.string().regex(/^[a-z]+$/), z.string()),
    photo: z.base64(),
    note: z
      .string()
      .meta({ examples: ['short', 'long'], unit: 'cm', 'x-internal': true }),
    shape: z.union([
      z.object({ kind: z.literal('circle'), radius: z.number() }),
      z.object({ kind: z.literal('square'), side: z.number() }),
    ]),
    gone: z.never().optional(),
  })
  .meta({ id: 'Owner' })

const bearer = securityScheme('bearer', { type: 'http', scheme: 'bearer' })

export const varietyBag = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/owners/:ownerId')
      .validate(z.object({ params: z.object({ ownerId: z.string() }) }))
      .metaData({
        summary: 'Get an owner',
        description: 'One owner with its pet.',
        tags: ['owners', 'pets'],
        deprecated: true,
        externalDocs: { url: 'https://example.com/owners' },
        servers: [{ url: 'https://legacy.example.com' }],
        security: [[bearer]],
        'x-audience': 'partners',
        internal: true,
      })
      .responses({
        200: json(Owner, {
          description: 'The owner',
          headers: z.object({
            'x-rate-limit': z.int(),
            'x-trace': z.string().optional(),
          }),
        }),
      })
  )
  .addRoute(
    Route.post('/owners')
      .validate(
        z.object({
          query: z.object({ filter: z.object({ status: Status }).optional() }),
          body: Owner,
        })
      )
      .metaData({ tags: ['owners'] })
      .responses({ 201: json(Owner) })
  )
  .build()

export const varietyOptions: DocumentOptions = {
  info: {
    title: 'Variety',
    description: 'Every writer feature',
    contact: { name: 'API team', email: 'api@example.com' },
    license: { name: 'MIT' },
    version: '1.0.0',
  },
  servers: [
    {
      url: 'https://{region}.example.com',
      description: 'Production',
      variables: { region: { default: 'eu', enum: ['eu', 'us'] } },
    },
  ],
  tags: [{ name: 'owners', description: 'Pet owners' }],
}
