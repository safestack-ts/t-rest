import { BagOfRoutes, Route } from '@t-rest/core'
import { TypedExpressApplication } from '@t-rest/express-server'
import Express from 'express'
import { z } from 'zod'
import { SupertestAdapter } from '../classes/supertest-adapter.js'

const fields = z.object({
  count: z.number().optional(),
  coerced: z.coerce.number().optional(),
  either: z.union([z.string(), z.number()]).optional(),
  flag: z.boolean().optional(),
  date: z.date().optional(),
  cleared: z.union([z.literal(''), z.null()]).optional(),
  nullableNumber: z.number().nullable().optional(),
  tags: z.array(z.string()),
  optionalTags: z.array(z.string()).optional(),
  meta: z.object({ sizes: z.array(z.coerce.number()) }).optional(),
})

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/fields')
      .multipart()
      .validate(z.object({ body: fields }))
      .response<null>()
  )
  .addRoute(
    Route.put('/avatar')
      .multipart()
      .validate(z.object({ file: z.object({ originalname: z.string() }) }))
      .response<null>()
  )
  .addRoute(
    Route.put('/gallery')
      .multipart()
      .validate(z.object({ files: z.array(z.object({})) }))
      .response<null>()
  )
  .addRoute(
    Route.patch('/documents')
      .multipart({ json: true })
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .response<null>()
  )
  .addRoute(Route.get('/items').response<null>())
  .build()

const adapter = SupertestAdapter.withoutVersioning(
  TypedExpressApplication.withoutVersioning(Express(), bagOfRoutes)
)

const file = { field: 'avatar', buffer: Buffer.from(''), filename: 'a.png' }

export const typedCalls = () => {
  adapter.post('/fields', {
    multipart: {
      fields: {
        coerced: 1,
        either: 1,
        cleared: null,
        tags: ['a'],
        optionalTags: [],
        meta: { sizes: [1] },
      },
    },
  })

  adapter.post('/fields', {
    // @ts-expect-error a number arrives as text, which z.number() rejects
    multipart: { fields: { tags: ['a'], count: 1 } },
  })

  adapter.post('/fields', {
    // @ts-expect-error a boolean arrives as text, which z.boolean() rejects
    multipart: { fields: { tags: ['a'], flag: true } },
  })

  adapter.post('/fields', {
    // @ts-expect-error a date arrives as text, which z.date() rejects
    multipart: { fields: { tags: ['a'], date: new Date() } },
  })

  adapter.post('/fields', {
    // @ts-expect-error null arrives as an empty string
    multipart: { fields: { tags: ['a'], nullableNumber: null } },
  })

  // @ts-expect-error an empty array is left out, a required one is missing then
  adapter.post('/fields', { multipart: { fields: { tags: [] } } })

  adapter.put('/avatar', { multipart: { files: [file] } })

  // @ts-expect-error a required file has to be sent
  adapter.put('/avatar', { multipart: {} })

  // @ts-expect-error a required file has to be sent
  adapter.put('/avatar', { multipart: { files: [] } })

  // multer gives an empty array without files
  adapter.put('/gallery', { multipart: {} })

  // a route taking either encoding takes either input
  adapter.patch('/documents', { body: { name: 'a' } })
  adapter.patch('/documents', { multipart: { fields: { name: 'a' } } })

  // @ts-expect-error the json body stays typed
  adapter.patch('/documents', { body: { name: 1 } })

  adapter.untyped.post('/fields', { multipart: { fields: { anything: 1 } } })

  // @ts-expect-error GET sends no body, so no form either
  adapter.invalid.get('/items', { multipart: {} })
}
