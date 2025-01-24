import { BagOfRoutes, Route, ze } from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/api/users/me').response<User>())
  .addRoute(
    Route.get('/api/users/:userId')
      .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
      .response<User>()
  )
  .addRoute(
    Route.get('/api/posts/:postId/comments')
      .validate(z.object({ params: z.object({ postId: ze.parseInteger() }) }))
      .response<{ id: number; text: string }>()
  )
  .build()

test('mounting on initial path with branching is working', async () => {
  const expressApp = Express()
  const rootRouter = Express.Router()
  expressApp.use('/api', rootRouter)

  const app = TypedExpressApplication.withoutVersioning(
    rootRouter as any,
    bagOfRoutes,
    '/api'
  )

  const usersRouter = app.branch('/users')
  const postsRouter = app.branch('/posts')

  usersRouter.get('/me').handle(() => ({
    statusCode: 200,
    data: { id: 1, email: 'jon.doe@email.com' },
  }))

  usersRouter.get('/:userId').handle((_, { params: { userId } }) => ({
    statusCode: 200,
    data: { id: userId, email: `user-${userId}@email.com` },
  }))

  postsRouter.get('/:postId/comments').handle((_, { params: { postId } }) => ({
    statusCode: 200,
    data: { id: postId, text: `comment-${postId}` },
  }))

  const response = await request(expressApp)
    .get('/api/users/1')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual({
    id: 1,
    email: `user-1@email.com`,
  })
})
