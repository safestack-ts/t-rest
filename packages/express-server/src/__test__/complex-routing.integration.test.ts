import { BagOfRoutes, Route, ze } from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'
import { defineMiddleware } from '../utils/define-middleware'
import { ExpressRequest } from '../types/express-type-shortcuts'
import { TypedExpressApplication } from '../classes/typed-express-application'
import Express from 'express'
import request from 'supertest'

type Post = {
  id: number
  title: string
  content: string
}

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  // public route without authentication
  .addRoute(Route.get('/api/posts').response<Post[]>())
  // private route with user authentication
  .addRoute(
    Route.get('/api/users/:userId')
      .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
      .response<User>()
  )
  // admin route with admin authentication
  .addRoute(
    Route.get('/api/admin/posts/:postId/comments')
      .validate(z.object({ params: z.object({ postId: ze.parseInteger() }) }))
      .response<{ id: number; text: string }>()
  )
  // external route with custom jwt authentication
  /*.addRoute(
    Route.get('/api/external/users')
      .validate(
        z.object({ headers: z.object({ authorization: z.string().min(1) }) })
      )
      .response<User[]>()
  )*/
  .build()

type RequestWithClientId = ExpressRequest & {
  context: {
    clientId: number
  }
}

const withClientId = defineMiddleware<ExpressRequest, RequestWithClientId>(
  (req, res, next) => {
    ;(req as RequestWithClientId).context = {
      clientId: 1,
    }
    next()
  }
)

type RequestWithUserAuth = ExpressRequest & {
  user: {
    id: number
  }
}

const userAuthentication = defineMiddleware<
  ExpressRequest,
  RequestWithUserAuth
>((req, res, next) => {
  ;(req as RequestWithUserAuth).user = {
    id: 42,
  }
  next()
})

type RequestWithAdminAuth = ExpressRequest & {
  admin: {
    id: number
  }
}

const withAdminAuth = defineMiddleware<ExpressRequest, RequestWithAdminAuth>(
  (req, res, next) => {
    ;(req as RequestWithAdminAuth).admin = {
      id: 1337,
    }
    next()
  }
)

const getExpressApp = (matcher: (req: ExpressRequest) => void) => {
  const expressApp = Express()
  const rootRouter = Express.Router()

  expressApp.use('/', rootRouter)

  const app = TypedExpressApplication.withoutVersioning(
    rootRouter,
    bagOfRoutes,
    '/'
  )

  app
    .branch('/api')
    .use(withClientId)
    .router((router) => {
      router.branch('/posts').router((router) => {
        router.get('/').handle((req, __, response) => {
          matcher(req)
          response
            .status(200)
            .json([{ id: 1, title: 'Post 1', content: 'Content 1' }])
        })
      })
      router
        .branch('/users')
        .use(userAuthentication)
        .router((router) => {
          router
            .get('/:userId')
            .handle((req, { params: { userId } }, response) => {
              response
                .status(200)
                .json({ id: userId, email: 'john.doe@example.com' })
            })
        })
      router
        .branch('/admin')
        .use(withAdminAuth)
        .router((router) => {
          router.branch('/posts').router((router) => {
            router
              .get('/:postId/comments')
              .handle((req, { params: { postId } }, response) => {
                response.status(200).json({ id: postId, text: 'Comment 1' })
              })
          })
        })
    })

  return expressApp
}

test('public route', async () => {
  const expressApp = getExpressApp((req) => {
    expect((req as any).admin).toBeUndefined()
    expect((req as any).user).toBeUndefined()
    expect((req as RequestWithClientId).context).toEqual({ clientId: 1 })
  })

  const response = await request(expressApp).get('/api/posts')

  expect(response.status).toBe(200)
  expect(response.body).toEqual([
    { id: 1, title: 'Post 1', content: 'Content 1' },
  ])
})

test('private route', async () => {
  const expressApp = getExpressApp((req) => {
    expect((req as any).admin).toBeUndefined()
    expect((req as RequestWithClientId).context).toEqual({ clientId: 1 })
    expect((req as any).user).toEqual({ id: 42 })
  })

  const response = await request(expressApp).get('/api/users/42')

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ id: 42, email: 'john.doe@example.com' })
})

test('admin route', async () => {
  const expressApp = getExpressApp((req) => {
    expect((req as any).admin).toEqual({ id: 1337 })
    expect((req as RequestWithClientId).context).toEqual({ clientId: 1 })
    expect((req as any).user).toBeUndefined()
  })

  const response = await request(expressApp).get('/api/admin/posts/42/comments')

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ id: 42, text: 'Comment 1' })
})
