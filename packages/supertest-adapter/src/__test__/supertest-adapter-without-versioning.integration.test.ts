import { BagOfRoutes, Route, ze } from '@t-rest/core'
import { TypedExpressApplication } from '@t-rest/express-server'
import { User, Basket, Person } from '@t-rest/testing-utilities'
import { z } from 'zod'
import Express from 'express'
import { SupertestAdapter } from '../classes/supertest-adapter'
import { AssertTrue } from 'conditional-type-checks'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/users/:userId')
      .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
      .response<User>()
  )
  .addRoute(
    Route.post('/users')
      .validate(
        z.object({ body: z.object({ id: z.number(), email: z.string() }) })
      )
      .response<User>()
  )
  .build()

const makeTypedExpressApplication = () => {
  const expressApp = Express()
  expressApp.use(Express.json())

  const typedRESTApplication = TypedExpressApplication.withoutVersioning(
    expressApp,
    bagOfRoutes
  )

  typedRESTApplication
    .get('/users/:userId')
    .handle((_, { params: { userId } }, response) => {
      response.status(200).json({
        id: userId,
        email: `user-${userId}@email.com`,
      })
    })

  typedRESTApplication.post('/users').handle((_, { body }, response) => {
    response.status(201).json({
      id: body.id,
      email: body.email,
    })
  })

  return typedRESTApplication
}

test('GET with param is called and status code is checked', async () => {
  const expressApp = makeTypedExpressApplication()
  const supertestInstance = SupertestAdapter.withoutVersioning(expressApp)

  const { body } = await supertestInstance.get('/users/:userId', {
    params: {
      userId: 42,
    },
    expect: {
      status: 200,
      headers: {
        'content-type': /application\/json/,
      },
    },
  })

  type _test = AssertTrue<typeof body extends User ? true : false>

  expect(body).toEqual({
    id: 42,
    email: 'user-42@email.com',
  })
})

test('POST is called and correct body is sent', async () => {
  const expressApp = makeTypedExpressApplication()
  const supertestInstance = SupertestAdapter.withoutVersioning(expressApp)

  const { body } = await supertestInstance.post('/users', {
    body: {
      id: 1337,
      email: 'jon.doe@email.com',
    },
    expect: {
      status: 201,
      headers: {
        'content-type': /application\/json/,
      },
    },
  })

  expect(body).toEqual({
    id: 1337,
    email: 'jon.doe@email.com',
  })
})
