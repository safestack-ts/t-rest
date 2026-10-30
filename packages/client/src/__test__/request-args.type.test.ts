import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { AssertFalse, AssertTrue, Has, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import { RESTClient } from '../classes/rest-client.js'
import { VersionInjector } from '../classes/version-injector.js'
import { HTTPAdapter } from '../types/http-adapter.js'
import { RequestArgs } from '../types/request-args.js'
import { RequestConfig } from '../types/request-config.js'

type Context = { signal?: AbortSignal }

namespace _RequestArgs {
  type OptionalInput = { query?: { page?: number } }
  type RequiredInput = { params: { id: string } }

  type _optionalConfigKeepsInput = AssertTrue<
    IsExact<
      RequestArgs<OptionalInput, '/items', Context>,
      [path: '/items', requestConfig?: RequestConfig & OptionalInput & Context]
    >
  >
  type _requiredConfig = AssertTrue<
    IsExact<
      RequestArgs<RequiredInput, '/items/:id', Context>,
      [
        path: '/items/:id',
        requestConfig: RequestConfig & RequiredInput & Context
      ]
    >
  >
  type _emptyInputHasOptionalConfig = AssertTrue<
    IsExact<
      RequestArgs<{}, '/items', Context>,
      [path: '/items', requestConfig?: RequestConfig & Context]
    >
  >
}

namespace _Client {
  const versionHistory = VersionHistory(['2024-01-01'] as const)
  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/items')
        .validate(
          z.object({
            query: z
              .object({
                page: z.number().optional(),
                search: z.string().optional(),
              })
              .optional(),
          })
        )
        .response<string[]>()
    )
    .addRoute(
      Route.version('2024-01-01')
        .get('/items/:id')
        .validate(z.object({ params: z.object({ id: z.string() }) }))
        .response<string>()
    )
    .addRoute(Route.version('2024-01-01').get('/health').response<string>())
    .build()

  class TestVersionInjector extends VersionInjector {}

  const client = RESTClient.withVersioning(
    bagOfRoutes,
    '2024-01-01',
    null as unknown as HTTPAdapter<Context>,
    TestVersionInjector
  )

  // the config of a route with only optional input can be omitted ...
  client.get('/items')
  // ... and its optional input is typed
  client.get('/items', {
    query: { page: 1 },
    signal: new AbortController().signal,
  })
  // @ts-expect-error - page is a number
  client.get('/items', { query: { page: '1' } })
  // @ts-expect-error - unknown query key
  client.get('/items', { query: { unknown: 1 } })

  // the config of a route with required input is required
  // @ts-expect-error - params are missing
  client.get('/items/:id')
  client.get('/items/:id', { params: { id: '1' } })

  // a route without validation accepts the request config
  client.get('/health', { headers: { 'accept-language': 'de' } })

  type ItemsArgs = Parameters<typeof client.get<'/items'>>
  type _itemsConfigHasQuery = AssertTrue<
    Has<
      NonNullable<ItemsArgs[1]>,
      { query?: { page?: number; search?: string } }
    >
  >
  type _itemsConfigIsOptional = AssertFalse<
    IsExact<undefined extends ItemsArgs[1] ? true : false, false>
  >
}
