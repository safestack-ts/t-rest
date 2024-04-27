import { BagOfRoutes, Route, ze } from '@typed-rest/core'
import Express from 'express'
import { z } from 'zod'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { User, Basket, Person } from '@typed-rest/testing-utilities'
import { TypedExpressApplication } from '../classes/typed-express-application'

const baseBagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(new Route().get('/users/me').response<User>())
  .addRoute(
    new Route()
      .get('/users/:userId')
      .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
      .response<User>()
  )

test('simple express app without versioning routing is working', async () => {
  const expressApp = Express()
  const bagOfRoutes = baseBagOfRoutes.build()
  const typedRESTApplication = TypedExpressApplication.withoutVersioning(
    expressApp,
    bagOfRoutes
  )

  typedRESTApplication.get('/users/me').handle(() => ({
    statusCode: StatusCodes.OK,
    data: { id: 1, email: 'jon.doe@email.com' },
  }))

  typedRESTApplication
    .get('/users/:userId')
    .handle((_, { params: { userId } }) => ({
      statusCode: StatusCodes.OK,
      data: { id: userId, email: `user-${userId}@email.com` },
    }))

  const response = await request(expressApp)
    .get('/users/1')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<User>({ id: 1, email: `user-1@email.com` })
})

test('express app with multiple routers without versioning is working', async () => {
  const expressApp = Express()

  const bagOfRoutes = baseBagOfRoutes
    .addRoute(
      new Route()
        .get('/baskets/:basketId')
        .validate(z.object({ params: z.object({ basketId: z.string() }) }))
        .response<Basket>()
    )
    .addRoute(new Route().post('/baskets').response<Basket>())
    .build()

  const typedRESTApplication = TypedExpressApplication.withoutVersioning(
    expressApp,
    bagOfRoutes
  )

  const userRouter = typedRESTApplication.branch('/users')
  userRouter.get('/me').handle(() => ({
    statusCode: StatusCodes.OK,
    data: { id: 1, email: 'jon.doe@email.com' },
  }))
  userRouter.get('/:userId').handle((_, { params: { userId } }) => ({
    statusCode: StatusCodes.OK,
    data: { id: userId, email: `user-${userId}@email.com` },
  }))

  const basketRouter = typedRESTApplication.branch('/baskets')

  basketRouter.get('/:basketId').handle((_, { params: { basketId } }) => ({
    statusCode: StatusCodes.OK,
    data: { id: basketId, entries: [] },
  }))

  basketRouter.post('/').handle(() => ({
    statusCode: StatusCodes.CREATED,
    data: { id: '123', entries: [] },
  }))

  const createUserResponse = await request(expressApp)
    .get('/users/1')
    .expect(StatusCodes.OK)

  expect(createUserResponse.body).toEqual<User>({
    id: 1,
    email: `user-1@email.com`,
  })

  const createBasketResponse = await request(expressApp)
    .post('/baskets')
    .expect(StatusCodes.CREATED)

  expect(createBasketResponse.body).toEqual<Basket>({
    id: '123',
    entries: [],
  })
})

test('nested routers without versioning is working', async () => {
  const expressApp = Express()

  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(new Route().get('/users/admin').response<User[]>())
    .addRoute(
      new Route()
        .get('/users/admin/:userId/persons')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<Person[]>()
    )
    .addRoute(
      new Route()
        .get('/users/:userId')
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<User>()
    )
    .build()

  const typedRESTApplication = TypedExpressApplication.withoutVersioning(
    expressApp,
    bagOfRoutes
  )

  const userRouter = typedRESTApplication.branch('/users')
  const userAdminRouter = userRouter.branch('/admin')

  userAdminRouter.get('/').handle(() => ({
    statusCode: StatusCodes.OK,
    data: [{ id: 1, email: 'jon.doe@email.com' }],
  }))

  userAdminRouter.get('/:userId/persons').handle(() => ({
    statusCode: StatusCodes.OK,
    data: [{ id: 1, name: 'Jon Doe' }],
  }))

  userRouter.get('/:userId').handle((_, { params: { userId } }) => ({
    statusCode: StatusCodes.OK,
    data: { id: userId, email: `user-${userId}@email.com` },
  }))

  const getUserPersonsAdminResponse = await request(expressApp)
    .get('/users/admin/1/persons')
    .expect(StatusCodes.OK)

  expect(getUserPersonsAdminResponse.body).toEqual<Person[]>([
    { id: 1, name: 'Jon Doe' },
  ])

  const getUsersAdminResponse = await request(expressApp)
    .get('/users/admin')
    .expect(StatusCodes.OK)

  expect(getUsersAdminResponse.body).toEqual<User[]>([
    { id: 1, email: 'jon.doe@email.com' },
  ])

  const getUserResponse = await request(expressApp)
    .get('/users/1')
    .expect(StatusCodes.OK)

  expect(getUserResponse.body).toEqual<User>({
    id: 1,
    email: `user-1@email.com`,
  })
})
