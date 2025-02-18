import { BagOfRoutes, Route, RouteInput, ze } from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import Express from 'express'
import { TypedExpressApplication } from '../classes/typed-express-application'
import request from 'supertest'
import { z } from 'zod'
import { StatusCodes } from 'http-status-codes'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/users')
      .validate(
        z.object({
          query: z.object({
            page: ze.parseInteger().optional().default(1),
            limit: ze.parseInteger().optional().default(10),
            from: ze.parseDate(),
          }),
        })
      )
      .response<User[]>()
  )
  .build()

test('validation with coercions coerced values are passed into route handler', async () => {
  const expressApp = Express()

  const app = TypedExpressApplication.withoutVersioning(expressApp, bagOfRoutes)

  let receivedQuery: RouteInput<typeof bagOfRoutes, 'GET', '/users'>['query'] =
    {} as any

  app.get('/users').handle(async (_, { query }, response) => {
    receivedQuery = query

    response.status(200).json([])
  })

  await request(expressApp)
    .get('/users?page=2&from=2025-01-01')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(receivedQuery.page).toBe(2)
  expect(typeof receivedQuery.page).toBe('number')

  expect(receivedQuery.from).toBeInstanceOf(Date)
  expect(receivedQuery.from.toISOString()).toBe('2025-01-01T00:00:00.000Z')
})
