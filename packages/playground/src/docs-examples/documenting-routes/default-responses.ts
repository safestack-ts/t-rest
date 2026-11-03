import { BagOfRoutes, json } from '@t-rest/core'
import { z } from 'zod'
import { createProduct } from './request-examples.js'
import { getManual, getProduct } from './responses.js'

const Problem = z
  .object({ message: z.string(), issues: z.array(z.string()) })
  .meta({ id: 'Problem' })

export const badRequest = json(Problem, {
  id: 'BadRequest',
  description: 'The request does not match the route',
})

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(getProduct)
  .addRoute(getManual)
  .addRoute(createProduct)
  .build()
  .withDefaultResponses({
    400: badRequest,
    500: json(Problem, {
      id: 'InternalError',
      description: 'Unexpected error',
    }),
  })
