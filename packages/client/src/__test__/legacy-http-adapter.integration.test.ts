import {
  BagOfRoutes,
  HTTPMethod,
  json,
  Route,
  VersionHistory,
  Versioning,
} from '@t-rest/core'
import { expect, test } from 'vitest'
import { RESTClient } from '../classes/rest-client.js'
import { VersionInjector } from '../classes/version-injector.js'
import { HTTPAdapter } from '../types/http-adapter.js'
import { RequestConfig } from '../types/request-config.js'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/invoices').responses({ 200: json<{ id: number }>() }))
  .build()

// an adapter written against the signature before `responses` was added
class LegacyHTTPAdapter implements HTTPAdapter<{ traceId?: string }> {
  public requestConfigs: unknown[] = []

  async request(
    _method: HTTPMethod,
    _url: string,
    _data: unknown,
    requestConfig?: RequestConfig & { traceId?: string }
  ): Promise<any> {
    this.requestConfigs.push(requestConfig)

    return { data: { id: 1 }, statusCode: 200 }
  }
}

class HeaderInjector extends VersionInjector {
  modifyHeaders(headers: Record<string, string | number | boolean>) {
    return { ...headers, 'x-version': 'v1' }
  }
}

test('an adapter without responses keeps receiving its request config', async () => {
  const adapter = new LegacyHTTPAdapter()
  const client = RESTClient.withoutVersioning(bagOfRoutes, adapter)

  await client.get('/invoices', {
    headers: { authorization: 'Bearer token' },
    traceId: 'trace',
  })

  expect(adapter.requestConfigs).toEqual([
    {
      headers: { authorization: 'Bearer token' },
      traceId: 'trace',
    },
  ])
})

test('the version headers reach an adapter without responses', async () => {
  const adapter = new LegacyHTTPAdapter()
  const client = RESTClient.withVersioning(
    BagOfRoutes.withVersioning(
      Versioning.DATE,
      VersionHistory(['2024-01-01'] as const)
    )
      .addRoute(Route.version('2024-01-01').get('/invoices').response<number>())
      .build(),
    '2024-01-01',
    adapter,
    HeaderInjector
  )

  await client.get('/invoices')

  expect(adapter.requestConfigs).toEqual([{ headers: { 'x-version': 'v1' } }])
})
