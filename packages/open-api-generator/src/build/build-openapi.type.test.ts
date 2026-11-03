import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import {
  AnyBag,
  buildOpenAPI,
  OpenAPIConfig,
  RouteView,
  Server,
} from '../index.js'

const bag = BagOfRoutes.withVersioning(
  Versioning.DATE,
  VersionHistory(['2024-01-01', '2025-01-01'] as const)
)
  .addRoute(
    Route.version('2024-01-01')
      .get('/a')
      .metaData({ public: true, owner: 'shop' })
      .response(204)
  )
  .addRoute(Route.version('2025-01-01').get('/b').response(204))
  .build()

type View = RouteView<typeof bag>
type _metaKeysOfAnyRoute = AssertTrue<
  IsExact<View['meta']['public'], boolean | undefined>
>
type _metaKeysKeepTheirType = AssertTrue<
  IsExact<View['meta']['owner'], string | undefined>
>
type _routeMetaKeys = AssertTrue<
  IsExact<View['meta']['tags'], readonly string[] | undefined>
>
type _versionOfTheHistory = AssertTrue<
  IsExact<View['version'], '2024-01-01' | '2025-01-01' | ''>
>

const specs: OpenAPIConfig<typeof bag>['specs'] = [
  { version: '2024-01-01', target: '3.0', output: 'v1.yaml' },
  { versions: ['2025-01-01'], target: '3.1', output: '{version}.json' },
  { versions: 'all', target: '3.2', output: '{version}.yaml' },
  { target: '3.1', output: 'api.yaml', filter: (route) => !!route.meta.public },
  // @ts-expect-error not a version of the history
  { version: '2023-01-01', target: '3.1', output: 'api.yaml' },
  // @ts-expect-error not a target
  { target: '2.0', output: 'api.yaml' },
  // @ts-expect-error version and versions exclude each other
  { version: '2024-01-01', versions: 'all', target: '3.1', output: 'a.yaml' },
]

buildOpenAPI({
  bag,
  info: { title: 'Shop' },
  diagnostics: {
    'response/untyped-json': 'error',
    // @ts-expect-error not a configurable diagnostic
    'naming/duplicate-id': 'warning',
  },
  specs,
})

const describeServers = <TBag extends AnyBag>(
  config: OpenAPIConfig<TBag>
): readonly Server[] => config.servers ?? []
describeServers({ bag, info: { title: 'Shop' }, specs })
