import { AssertTrue } from 'conditional-type-checks'
import { Route } from './classes/core/route'
import { ExtractLatestMatchingRoutePerPath } from './types/extract-version-matching-route'
import { VersionHistory } from './utils/version-history'

const getBasketV1 = Route.version('2025-01-01')
  .get('/basket')
  .response<{ version: '2025-01-01' }>()

const getBasketV2 = Route.version('2025-02-18')
  .get('/basket')
  .response<{ version: '2025-02-18' }>()

const getBasketEntriesV1 = Route.version('2025-01-01')
  .get('/basket/:basketId/entries')
  .response<{ version: '2025-01-01' }>()

type GetBasketV1 = typeof getBasketV1
type GetBasketV2 = typeof getBasketV2
type GetBasketEntriesV1 = typeof getBasketEntriesV1

type Routes = GetBasketV1 | GetBasketV2 | GetBasketEntriesV1

const versionHistory = VersionHistory(['2025-01-01', '2025-02-18'] as const)
type VersionHistory = typeof versionHistory

type ResolvedRouteForLatestVersion = ExtractLatestMatchingRoutePerPath<
  Routes,
  '2025-02-18',
  VersionHistory
>
type ResolvedRouteForOlderVersion = ExtractLatestMatchingRoutePerPath<
  Routes,
  '2025-01-01',
  VersionHistory
>

type GetBasketV2IsPartOfLatestVersion =
  GetBasketV2 extends ResolvedRouteForLatestVersion ? true : false
type GetBasketV1IsPartOfOlderVersion =
  GetBasketV1 extends ResolvedRouteForOlderVersion ? true : false

type GetBasketEntriesV1IsPartOfLatestVersion =
  GetBasketEntriesV1 extends ResolvedRouteForLatestVersion ? true : false
type GetBasketEntriesV1IsPartOfOlderVersion =
  GetBasketEntriesV1 extends ResolvedRouteForOlderVersion ? true : false

type _test =
  | AssertTrue<GetBasketV2IsPartOfLatestVersion>
  | AssertTrue<GetBasketV1IsPartOfOlderVersion>
  | AssertTrue<GetBasketEntriesV1IsPartOfLatestVersion>
  | AssertTrue<GetBasketEntriesV1IsPartOfOlderVersion>
