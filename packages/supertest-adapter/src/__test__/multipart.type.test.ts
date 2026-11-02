import { BagOfRoutes, Route } from '@t-rest/core'
import { TypedExpressApplication } from '@t-rest/express-server'
import Express from 'express'
import { z } from 'zod'
import { SupertestAdapter } from '../classes/supertest-adapter.js'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/uploads')
      .multipart()
      .validate(
        z.object({
          body: z.object({ name: z.string() }),
          files: z.array(z.object({ originalname: z.string() })),
        })
      )
      .response<{ id: number }>()
  )
  .addRoute(
    Route.post('/json')
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .response<{ id: number }>()
  )
  .build()

const adapter = SupertestAdapter.withoutVersioning(
  TypedExpressApplication.withoutVersioning(Express(), bagOfRoutes)
)

export const typedCalls = () => {
  const typed = adapter.post('/uploads', {
    multipart: {
      fields: { name: 'winter' },
      files: [{ field: 'a', buffer: Buffer.from(''), filename: 'a.txt' }],
    },
  })
  typed.then((response) => response.body.id satisfies number)

  // @ts-expect-error the fields are typed by the body of the validator
  adapter.post('/uploads', { multipart: { fields: { name: 1 } } })

  // @ts-expect-error the fields of a validated body are required
  adapter.post('/uploads', { multipart: {} })

  // @ts-expect-error the multipart description is required
  adapter.post('/uploads', {})

  // @ts-expect-error the parsed body is no input of a multipart route
  adapter.post('/uploads', { body: { name: 'winter' } })

  adapter.post('/uploads', {
    multipart: {
      fields: { name: 'winter' },
      // @ts-expect-error a buffer needs a filename
      files: [{ field: 'a', buffer: Buffer.from('') }],
    },
  })

  adapter.post('/json', {
    body: { name: 'winter' },
    // @ts-expect-error json routes take no multipart description
    multipart: { fields: { name: 'winter' } },
  })
}
