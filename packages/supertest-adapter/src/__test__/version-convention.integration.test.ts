import { describe, expect, test } from 'vitest'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import {
  RESTClient,
  versionInjectorFrom as clientVersionInjectorFrom,
  type HTTPAdapter,
} from '@t-rest/client'
import { TypedExpressApplication } from '@t-rest/express-server'
import { versionExtractorFrom } from '@t-rest/express-server'
import { versionHeader } from '@t-rest/protocol'
import Express from 'express'
import supertest from 'supertest'
import { SupertestAdapter } from '../classes/supertest-adapter.js'
import { versionInjectorFrom } from '../utils/version-injector-from.js'

const versionHistory = VersionHistory(['2024-01-01', '2024-02-01'] as const)

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/api/version').response<{ v: string }>()
  )
  .addRoute(
    Route.version('2024-02-01').get('/api/version').response<{ v: string }>()
  )
  .build()

// a single declaration of where the version travels, for all three sides
const convention = versionHeader('x-api-version')

const makeApplication = () => {
  const app = TypedExpressApplication.withVersioning(
    Express(),
    bagOfRoutes,
    versionHistory,
    versionExtractorFrom(convention, {
      parseDate: (version) => new Date(version),
    })
  )
  app
    .get('/api/version')
    .version('2024-01-01')
    .handle((_, __, response) => {
      response.json({ v: '2024-01-01' })
    })
  app
    .get('/api/version')
    .version('2024-02-01')
    .handle((_, __, response) => {
      response.json({ v: '2024-02-01' })
    })

  return app
}

// sends the requests of the client to the express application in process
const inProcessAdapter = (target: Parameters<typeof supertest>[0]) =>
  ({
    async request(method, url, data, requestConfig) {
      const response = await supertest(target)
        [method.toLowerCase() as 'get'](url)
        .set((requestConfig?.headers ?? {}) as Record<string, string>)
        .send(data as object | undefined)

      return { data: response.body, statusCode: response.status }
    },
  } satisfies HTTPAdapter)

describe('one version convention for server, supertest and client', () => {
  test('supertest sends the version the server reads', async () => {
    const app = makeApplication()
    const adapter = SupertestAdapter.withVersioning(
      app,
      versionInjectorFrom(convention)
    )

    const first = await adapter.get('/api/version', '2024-01-01', {})
    const second = await adapter.get('/api/version', '2024-02-01', {})

    expect(first.body).toEqual({ v: '2024-01-01' })
    expect(second.body).toEqual({ v: '2024-02-01' })
  })

  test('the client sends the version the server reads', async () => {
    const app = makeApplication()
    const client = RESTClient.withVersioning(
      bagOfRoutes,
      '2024-01-01',
      inProcessAdapter(app.expressApp as Parameters<typeof supertest>[0]),
      clientVersionInjectorFrom(convention)
    )

    expect((await client.get('/api/version')).data).toEqual({
      v: '2024-01-01',
    })
    expect(
      (await client.withVersion('2024-02-01').get('/api/version')).data
    ).toEqual({ v: '2024-02-01' })
  })
})
