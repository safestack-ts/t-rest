import { describe, expect, test } from 'vitest'
import {
  BagOfRoutes,
  HTTPMethod,
  ResponseMap,
  Route,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { z } from 'zod'
import { RESTClient } from '../classes/rest-client.js'
import { VersionInjector } from '../classes/version-injector.js'
import { HTTPAdapter, RequestBodyEncoding } from '../types/http-adapter.js'
import { HTTPResponse } from '../types/http-response.js'

class RecordingAdapter implements HTTPAdapter {
  public bodyEncodings: (RequestBodyEncoding | undefined)[] = []

  async request<TResponses extends ResponseMap>(
    _method: HTTPMethod,
    _url: string,
    _data: unknown,
    _requestConfig: unknown,
    _responses: TResponses,
    bodyEncoding?: RequestBodyEncoding
  ) {
    this.bodyEncodings.push(bodyEncoding)
    return { data: null, statusCode: 200 } as HTTPResponse<TResponses>
  }
}

class NoopVersionInjector extends VersionInjector {}

const body = z.object({ body: z.object({ name: z.string() }) })

describe('the body encoding passed to the http adapter', () => {
  test('follows the route without versioning', async () => {
    const adapter = new RecordingAdapter()
    const client = RESTClient.withoutVersioning(
      BagOfRoutes.withoutVersioning()
        .addRoute(Route.post('/json').validate(body).response<null>())
        .addRoute(Route.post('/upload').multipart().response<null>())
        .addRoute(
          Route.patch('/either')
            .multipart({ json: true })
            .validate(body)
            .response<null>()
        )
        .build(),
      adapter
    )

    await client.post('/json', { body: { name: 'a' } })
    // a FormData from another implementation is sent as multipart, too
    await client.post('/upload', { body: {} as FormData })
    await client.patch('/either', { body: { name: 'a' } })
    await client.patch('/either', { body: new FormData() })

    expect(adapter.bodyEncodings).toEqual([
      'json',
      'multipart',
      'json',
      'multipart',
    ])
  })

  test('follows the route of the requested version', async () => {
    const adapter = new RecordingAdapter()
    const versionHistory = VersionHistory(['2024-01-01', '2024-02-01'] as const)
    const client = RESTClient.withVersioning(
      BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
        .addRoute(
          Route.version('2024-01-01')
            .post('/upload')
            .validate(body)
            .response<null>()
        )
        .addRoute(
          Route.version('2024-02-01')
            .post('/upload')
            .multipart()
            .response<null>()
        )
        .build(),
      '2024-01-01',
      adapter,
      NoopVersionInjector
    )

    await client.post('/upload', { body: { name: 'a' } })
    await client
      .withVersion('2024-02-01')
      .post('/upload', { body: {} as FormData })

    expect(adapter.bodyEncodings).toEqual(['json', 'multipart'])
  })
})
