import {
  ResponseWithVersion,
  TestBagOfRoutesWithVersioning,
  User,
  UserWithTags,
} from '@t-rest/testing-utilities'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { DateVersionExtractor } from '../types/date-version-extractor'
import { TypedExpressApplication } from '../classes/typed-express-application'
import { ExpressApp, ExpressRequest } from '../types/express-type-shortcuts'

const { bagOfRoutes: baseBagOfRoutes, versionHistory } =
  TestBagOfRoutesWithVersioning

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

const initApplication = (expressApp: ExpressApp) => {
  expressApp.use(Express.json())

  const typedExpressApplication = TypedExpressApplication.withVersioning(
    expressApp,
    baseBagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor()
  )
  const userRouter = typedExpressApplication.branch('/users')

  userRouter
    .get('/:userId')
    .version('2024-01-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { params: { userId } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: userId, email: `user-${userId}@email.com` },
        })
      }
    )

  userRouter
    .get('/:userId')
    .version('2024-02-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { params: { userId } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: 42, email: `user-${userId}@email.com`, tags: ['tag1'] },
        })
      }
    )

  userRouter
    .post('/')
    .version('2024-02-01')
    .handle(
      (
        { version: { resolved: resolvedVersion } },
        { body: { name } },
        response
      ) => {
        response.status(200).json({
          version: resolvedVersion,
          data: { id: 42, email: `${name}@email.com`, tags: [] },
        })
      }
    )

  return typedExpressApplication
}

test('calling route without any version resolves to latest version', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/7487bdc6-f308-4852-ad06-07ff7fb7a349')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<UserWithTags>>({
    data: {
      id: 42,
      email: `user-7487bdc6-f308-4852-ad06-07ff7fb7a349@email.com`,
      tags: ['tag1'],
    },
    version: '2024-02-01',
  })
})

test('calling route with newer version resolves to latest available version of the route', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/7487bdc6-f308-4852-ad06-07ff7fb7a349')
    .set('X-API-Version', '2024-03-01')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<UserWithTags>>({
    data: {
      id: 42,
      email: `user-7487bdc6-f308-4852-ad06-07ff7fb7a349@email.com`,
      tags: ['tag1'],
    },
    version: '2024-02-01',
  })
})

test('calling route with outdated version resolves to outdated version of the route', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/1337')
    .set('X-API-Version', '2024-01-01')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 1337,
      email: `user-1337@email.com`,
    },
    version: '2024-01-01',
  })
})

test('calling route with version in between two history versions resolves to nearest lower version of the route', async () => {
  const expressApp = Express()
  initApplication(expressApp)

  const response = await request(expressApp)
    .get('/users/1337')
    .set('X-API-Version', '2024-01-15')
    .expect((res) =>
      !res.status.toString().startsWith('2') ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK)

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 1337,
      email: `user-1337@email.com`,
    },
    version: '2024-01-01',
  })
})
