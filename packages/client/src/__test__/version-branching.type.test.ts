import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { RESTClient } from '../classes/rest-client'
import { AssertTrue } from 'conditional-type-checks'

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/basket')
      .response<{ version: '2024-01-01' }>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .get('/basket')
      .response<{ version: '2024-02-01' }>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .get('/basket')
      .response<{ version: '2024-03-01' }>()
  )
  .build()

const client = RESTClient.withVersioning(bagOfRoutes, '2024-01-01', null as any)

const responseOldestVersion = client.get('/basket')
const responseMiddleVersion = client.withVersion('2024-02-01').get('/basket')
const responseLatestVersion = client.withVersion('2024-03-01').get('/basket')

type ResponseLatestVersionIsCorrect = Awaited<
  typeof responseLatestVersion
>['data'] extends {
  version: '2024-03-01'
}
  ? true
  : false
type ResponseMiddleVersionIsCorrect = Awaited<
  typeof responseMiddleVersion
>['data'] extends {
  version: '2024-02-01'
}
  ? true
  : false
type ResponseOldestVersionIsCorrect = Awaited<
  typeof responseOldestVersion
>['data'] extends {
  version: '2024-01-01'
}
  ? true
  : false

type _test =
  | AssertTrue<ResponseLatestVersionIsCorrect>
  | AssertTrue<ResponseMiddleVersionIsCorrect>
  | AssertTrue<ResponseOldestVersionIsCorrect>
