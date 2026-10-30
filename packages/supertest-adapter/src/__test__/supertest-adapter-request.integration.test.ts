import { beforeEach, describe, expect, test } from 'vitest'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import {
  DateVersionExtractor,
  ExpressRequest,
  TypedExpressApplication,
} from '@t-rest/express-server'
import { z } from 'zod'
import Express from 'express'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { VersionInjector } from '../classes/version-injector.js'

const versionHistory = VersionHistory(['2024-01-01'] as const)

const input = z.object({
  params: z.object({ itemId: z.string() }),
  query: z.object({
    search: z.string().optional(),
    ids: z.string().optional(),
  }),
  body: z.unknown().optional(),
})

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/items/:itemId')
      .validate(input)
      .response<{ ok: boolean }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/items/:itemId')
      .validate(input)
      .response<{ ok: boolean }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .put('/items/:itemId')
      .validate(input)
      .response<{ ok: boolean }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .patch('/items/:itemId')
      .validate(input)
      .response<{ ok: boolean }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .delete('/items/:itemId')
      .validate(input)
      .response<{ ok: boolean }>()
  )
  .build()

class HeaderVersionExtractor implements DateVersionExtractor {
  extractVersion(request: ExpressRequest) {
    return request.header('x-api-version')
  }
  parseDate(version: string) {
    return new Date(version)
  }
}

type Recorded = { method: string; url: string; body: unknown }

let recorded: Recorded[] = []

const makeApplication = () => {
  const expressApp = Express()
  expressApp.use(Express.json())
  expressApp.use((request, _, next) => {
    recorded.push({
      method: request.method,
      url: request.originalUrl,
      body: request.body,
    })
    next()
  })
  const app = TypedExpressApplication.withVersioning(
    expressApp,
    bagOfRoutes,
    versionHistory,
    new HeaderVersionExtractor()
  )

  for (const verb of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    app[verb]('/items/:itemId')
      .version('2024-01-01')
      .handle((_, __, response) => {
        response.json({ ok: true })
      })
  }

  return app
}

// modifies the path template, i.e. before the params are put into it
class TemplateInjector extends VersionInjector {
  static readonly paths: string[] = []

  modifyUrl(url: string, _version: string) {
    TemplateInjector.paths.push(url)

    return url
  }
}

beforeEach(() => {
  recorded = []
  TemplateInjector.paths.length = 0
})

const request = {
  params: { itemId: 'a b/c' },
  query: { search: 'a&b', ids: '[1,2]' },
  body: { name: 'chair' },
  expect: { status: 200 },
}

describe.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
  '%s',
  (verb) => {
    test('sends the encoded url and the body only for verbs with a body', async () => {
      const adapter = SupertestAdapter.withVersioning(
        makeApplication(),
        new TemplateInjector()
      )

      // the handlers of the verbs share their signature, only unioned they are not callable
      const call = adapter[verb] as typeof adapter.get
      await call('/items/:itemId', '2024-01-01', request)

      expect(recorded).toHaveLength(1)
      expect(recorded[0].method).toBe(verb.toUpperCase())
      expect(recorded[0].url).toBe(
        '/items/a%20b%2Fc?search=a%26b&ids=%5B1%2C2%5D'
      )
      if (verb === 'get' || verb === 'delete') {
        expect(Object.keys((recorded[0].body as object) ?? {})).toEqual([])
      } else {
        expect(recorded[0].body).toEqual({ name: 'chair' })
      }
    })
  }
)

test('the version injector modifies the path template', async () => {
  const adapter = SupertestAdapter.withVersioning(
    makeApplication(),
    new TemplateInjector()
  )

  await adapter.get('/items/:itemId', '2024-01-01', request)

  expect(TemplateInjector.paths).toEqual(['/items/:itemId'])
})
