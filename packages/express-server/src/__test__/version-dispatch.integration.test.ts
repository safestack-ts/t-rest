import { describe, expect, test, vi } from 'vitest'
import Express from 'express'
import request from 'supertest'
import { StatusCodes } from 'http-status-codes'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { versionHeader } from '@t-rest/protocol'
import { z } from 'zod'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { RouteSetupError } from '../classes/route-setup-error.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { defineMiddleware } from '../utils/define-middleware.js'
import { versionExtractorFrom } from '../utils/version-extractor-from.js'

const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

class APIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(Route.version('2024-01-01').get('/users').response<any>())
  .addRoute(Route.version('2024-02-01').get('/users').response<any>())
  .addRoute(Route.version('2024-03-01').get('/users').response<any>())
  .build()

const initApplication = () => {
  const expressApp = Express()
  const app = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    new APIVersionHeaderExtractor()
  )

  return { expressApp, app }
}

describe('registration order', () => {
  test('middleware registered between two versions only applies to later versions', async () => {
    const calls: string[] = []
    const { expressApp, app } = initApplication()

    app
      .get('/users')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json('v1')
      })

    const appWithMiddleware = app.use(
      defineMiddleware<ExpressRequest, unknown>((_, __, next) => {
        calls.push('middleware')
        next()
      })
    )

    appWithMiddleware
      .get('/users')
      .version('2024-02-01')
      .handle((_, __, response) => {
        response.json('v2')
      })

    await request(expressApp)
      .get('/users')
      .set('X-API-Version', '2024-02-01')
      .expect(StatusCodes.OK, '"v2"')
    expect(calls).toEqual(['middleware'])

    await request(expressApp)
      .get('/users')
      .set('X-API-Version', '2024-01-01')
      .expect(StatusCodes.OK, '"v1"')
    expect(calls).toEqual(['middleware'])
  })

  test('versions of one path are handled on the app and on a branch', async () => {
    const { expressApp, app } = initApplication()

    app
      .get('/users')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json('app v1')
      })

    app
      .branch('/')
      .get('/users')
      .version('2024-03-01')
      .handle((_, __, response) => {
        response.json('branch v3')
      })

    app
      .get('/users')
      .version('2024-02-01')
      .handle((_, __, response) => {
        response.json('app v2')
      })

    const expectVersion = (version: string, body: string) =>
      request(expressApp)
        .get('/users')
        .set('X-API-Version', version)
        .expect(StatusCodes.OK, body)

    await expectVersion('2024-01-01', '"app v1"')
    await expectVersion('2024-02-01', '"app v2"')
    await expectVersion('2024-03-01', '"branch v3"')
    // resolves down to the version of the app
    await expectVersion('2024-02-15', '"app v2"')
  })
})

describe('dispatch', () => {
  test('three versions register three express routes and one of them runs per request', async () => {
    const calls: string[] = []
    const { expressApp, app } = initApplication()
    const registerRoute = vi.spyOn(expressApp, 'get')

    for (const version of versionHistory) {
      app
        .get('/users')
        .version(version)
        .middleware(
          defineMiddleware<ExpressRequest, unknown>((_, __, next) => {
            calls.push(`middleware ${version}`)
            next()
          })
        )
        .handle((_, __, response) => {
          calls.push(`handler ${version}`)
          response.json(version)
        })
    }

    // express 4 also reads the `query parser fn` setting through `app.get`
    const userRoutes = registerRoute.mock.calls.filter(
      ([path]) => path === '/users'
    )
    expect(userRoutes).toHaveLength(3)

    await request(expressApp)
      .get('/users')
      .set('X-API-Version', '2024-02-01')
      .expect(StatusCodes.OK)

    expect(calls).toEqual(['middleware 2024-02-01', 'handler 2024-02-01'])
  })

  test('version specific path param names arrive natively', async () => {
    const paramsBag = BagOfRoutes.withVersioning(
      Versioning.DATE,
      versionHistory
    )
      .addRoute(
        Route.version('2024-01-01')
          .get('/users/:id')
          .validate(z.object({ params: z.strictObject({ id: z.string() }) }))
          .response<any>()
      )
      .addRoute(
        Route.version('2024-02-01')
          .get('/users/:userId')
          .validate(
            z.object({ params: z.strictObject({ userId: z.string() }) })
          )
          .response<any>()
      )
      .build()
    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      paramsBag,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/users/:id')
      .version('2024-01-01')
      .handle((req, { params }, response) => {
        response.json({ params, requestParams: req.params })
      })
    app
      .get('/users/:userId')
      .version('2024-02-01')
      .handle((req, { params }, response) => {
        response.json({ params, requestParams: req.params })
      })

    const v1 = await request(expressApp)
      .get('/users/5')
      .set('X-API-Version', '2024-01-01')
    const v2 = await request(expressApp)
      .get('/users/5')
      .set('X-API-Version', '2024-02-01')

    expect(v1.body).toEqual({
      params: { id: '5' },
      requestParams: { id: '5' },
    })
    expect(v2.body).toEqual({
      params: { userId: '5' },
      requestParams: { userId: '5' },
    })
  })

  test('next("route") of a route middleware continues with the next matching express route', async () => {
    const { expressApp, app } = initApplication()

    app
      .get('/users')
      .version('2024-02-01')
      .middleware(
        defineMiddleware<ExpressRequest, unknown>((_, __, next) =>
          next('route')
        )
      )
      .handle((_, __, response) => {
        response.json('typed')
      })

    // a sibling version has to be skipped as well
    app
      .get('/users')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json('v1')
      })

    expressApp.get('/users', (_, response) => {
      response.json('fallback')
    })

    await request(expressApp)
      .get('/users')
      .set('X-API-Version', '2024-02-01')
      .expect(StatusCodes.OK, '"fallback"')
  })

  test('unversioned routes dispatch without a version', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withoutVersioning(
      expressApp,
      BagOfRoutes.withoutVersioning()
        .addRoute(Route.get('/users').response<any>())
        .build()
    )

    app.get('/users').handle((request, _, response) => {
      response.json((request as unknown as { version: unknown }).version)
    })

    await request(expressApp).get('/users').expect(StatusCodes.OK, 'null')
  })
})

describe('duplicate handlers', () => {
  test('handling a version twice throws a route setup error', () => {
    const { app } = initApplication()

    app
      .get('/users')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json('v1')
      })

    const handleAgain = () =>
      app
        .get('/users')
        .version('2024-01-01')
        .handle((_, __, response) => {
          response.json('v1 again')
        })

    expect(handleAgain).toThrow(RouteSetupError)
    expect(handleAgain).toThrow(
      'Route GET /users version 2024-01-01 is already handled'
    )
  })

  test('handling a version twice on a branch throws a route setup error', () => {
    const { app } = initApplication()

    app
      .get('/users')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json('v1')
      })

    expect(() =>
      app
        .branch('/')
        .get('/users')
        .version('2024-01-01')
        .handle((_, __, response) => {
          response.json('v1 again')
        })
    ).toThrow(RouteSetupError)
  })

  test('handling an unversioned route twice throws a route setup error', () => {
    const app = TypedExpressApplication.withoutVersioning(
      Express(),
      BagOfRoutes.withoutVersioning()
        .addRoute(Route.get('/users').response<any>())
        .build()
    )

    app.get('/users').handle((_, __, response) => {
      response.json('first')
    })

    expect(() =>
      app.get('/users').handle((_, __, response) => {
        response.json('second')
      })
    ).toThrow('Route GET /users is already handled')
  })

  test('route setup errors are recognized across module copies', () => {
    const error = new RouteSetupError('boom')

    expect(RouteSetupError.isRouteSetupError(error)).toBe(true)
    expect(RouteSetupError.isRouteSetupError(new Error('boom'))).toBe(false)
  })
})

describe('withVersioning without version history argument', () => {
  test('uses the version history of the bag of routes', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      new APIVersionHeaderExtractor()
    )

    app
      .get('/users')
      .version('2024-01-01')
      .handle(({ version }, _, response) => {
        response.json(version)
      })

    app
      .get('/users')
      .version('2024-03-01')
      .handle(({ version }, _, response) => {
        response.json(version)
      })

    // no header falls back to the latest version of the history
    await request(expressApp).get('/users').expect(StatusCodes.OK, {
      requested: '2024-03-01',
      resolved: '2024-03-01',
    })
  })

  test('accepts a mount path', () => {
    const app = TypedExpressApplication.withVersioning(
      Express.Router(),
      bagOfRoutes,
      new APIVersionHeaderExtractor(),
      '/users'
    )

    expect(app.fullPath).toBe('/users')
  })
})

describe('versionExtractorFrom', () => {
  test('reads the version from the header of the convention', async () => {
    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      versionExtractorFrom(versionHeader('X-Api-Version'))
    )

    for (const version of ['2024-01-01', '2024-03-01'] as const) {
      app
        .get('/users')
        .version(version)
        .handle(({ version }, _, response) => {
          response.json(version)
        })
    }

    await request(expressApp)
      .get('/users')
      .set('x-api-version', '2024-01-01')
      .expect(StatusCodes.OK, {
        requested: '2024-01-01',
        resolved: '2024-01-01',
      })

    // without a date parser the requested version is resolved along the history
    await request(expressApp)
      .get('/users')
      .set('x-api-version', '2024-02-01')
      .expect(StatusCodes.OK, {
        requested: '2024-02-01',
        resolved: '2024-01-01',
      })
  })

  test('resolves by date if a date parser is given', async () => {
    const extractor = versionExtractorFrom(versionHeader('X-Api-Version'), {
      parseDate: (version) => new Date(version),
    })

    expect(extractor.parseDate('2024-02-01').toISOString()).toBe(
      '2024-02-01T00:00:00.000Z'
    )

    const expressApp = Express()
    const app = TypedExpressApplication.withVersioning(
      expressApp,
      bagOfRoutes,
      extractor
    )

    for (const version of ['2024-01-01', '2024-03-01'] as const) {
      app
        .get('/users')
        .version(version)
        .handle(({ version }, _, response) => {
          response.json(version)
        })
    }

    await request(expressApp)
      .get('/users')
      .set('X-Api-Version', '2024-02-15T00:00:00.000Z')
      .expect(StatusCodes.OK, {
        requested: '2024-02-15T00:00:00.000Z',
        resolved: '2024-01-01',
      })

    await request(expressApp)
      .get('/users')
      .set('X-Api-Version', 'not-a-date')
      .expect(StatusCodes.BAD_REQUEST)
  })
})
