import { describe, expect, test } from 'vitest'
import {
  BagOfRoutes,
  HTTPMethod,
  Route,
  VersionHistory,
  Versioning,
  ResponseMap,
} from '@t-rest/core'
import { z } from 'zod'
import { RESTClient } from '../classes/rest-client.js'
import { VersionInjector } from '../classes/version-injector.js'
import { HTTPAdapter } from '../types/http-adapter.js'
import { HTTPResponse } from '../types/http-response.js'
import { RequestConfig } from '../types/request-config.js'

const versionHistory = VersionHistory(['2024-01-01'] as const)

const input = z.object({
  params: z.object({ itemId: z.string() }),
  query: z.object({
    search: z.string().optional(),
    ids: z.string().optional(),
    tags: z.string().optional(),
  }),
  body: z.unknown().optional(),
})

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/items/:itemId').validate(input).response()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/items/:itemId')
      .validate(input)
      .response()
  )
  .addRoute(
    Route.version('2024-01-01').put('/items/:itemId').validate(input).response()
  )
  .addRoute(
    Route.version('2024-01-01')
      .patch('/items/:itemId')
      .validate(input)
      .response()
  )
  .addRoute(
    Route.version('2024-01-01')
      .delete('/items/:itemId')
      .validate(input)
      .response()
  )
  .build()

type Recorded = { method: HTTPMethod; url: string; data: unknown }

class RecordingHTTPAdapter implements HTTPAdapter {
  public readonly requests: Recorded[] = []

  async request<TResponses extends ResponseMap>(
    method: HTTPMethod,
    url: string,
    data: unknown,
    _responses: TResponses,
    _requestConfig?: RequestConfig
  ): Promise<HTTPResponse<TResponses>> {
    this.requests.push({ method, url, data })

    return { data: undefined, statusCode: 200 } as HTTPResponse<TResponses>
  }
}

// modifies the url the client built, not the path template
class UrlRecordingInjector extends VersionInjector {
  static readonly urls: string[] = []

  modifyUrl(url: string) {
    UrlRecordingInjector.urls.push(url)

    return url
  }
}

const makeClient = (adapter: HTTPAdapter) =>
  RESTClient.withVersioning(
    bagOfRoutes,
    '2024-01-01',
    adapter,
    UrlRecordingInjector
  )

const request = {
  params: { itemId: 'a b/c' },
  query: { search: 'a&b', ids: '[1,2]' },
  body: { name: 'chair' },
}

describe.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
  '%s',
  (verb) => {
    test('sends the encoded url and the body only for verbs with a body', async () => {
      const adapter = new RecordingHTTPAdapter()

      // the handlers of the verbs share their signature, only unioned they are not callable
      const client = makeClient(adapter)
      await (client[verb] as typeof client.get)('/items/:itemId', request)

      expect(adapter.requests).toEqual([
        {
          method: verb.toUpperCase(),
          url: '/items/a%20b%2Fc?search=a%26b&ids=%5B1%2C2%5D',
          data: verb === 'get' || verb === 'delete' ? undefined : request.body,
        },
      ])
    })
  }
)

test('placeholders without a param stay in the url and undefined query values are omitted', async () => {
  const adapter = new RecordingHTTPAdapter()

  await makeClient(adapter).get('/items/:itemId', {
    query: { search: undefined, ids: 'x' },
  } as never)

  expect(adapter.requests[0].url).toBe('/items/:itemId?ids=x')
})

test('the version injector modifies the built url', async () => {
  UrlRecordingInjector.urls.length = 0

  await makeClient(new RecordingHTTPAdapter()).get('/items/:itemId', request)

  expect(UrlRecordingInjector.urls).toEqual([
    '/items/a%20b%2Fc?search=a%26b&ids=%5B1%2C2%5D',
  ])
})
