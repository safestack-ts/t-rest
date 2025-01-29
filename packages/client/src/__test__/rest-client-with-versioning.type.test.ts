import {
  ResponseWithVersion,
  TestBagOfRoutesWithVersioning,
  User,
  UserWithTags,
} from '@t-rest/testing-utilities'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import { RESTClient } from '../classes/rest-client'

const { bagOfRoutes } = TestBagOfRoutesWithVersioning

const clientJanuary = RESTClient.withVersioning(
  bagOfRoutes,
  '2024-01-01',
  null as any
)
const clienFebruary = RESTClient.withVersioning(
  bagOfRoutes,
  '2024-02-01',
  null as any
)
const clientMarch = RESTClient.withVersioning(
  bagOfRoutes,
  '2024-03-01',
  null as any
)

// make sure that the client is not executing actual logic
const noop = () => {
  return undefined
}
;(clientJanuary as any).get = noop
;(clienFebruary as any).get = noop
;(clientMarch as any).get = noop

const responseJanuary = clientJanuary.get('/users/:userId', {
  params: { userId: 1 },
})
const responseFebruary = clienFebruary.get('/users/:userId', {
  params: { userId: '1' },
})
const responseMarch = clientMarch.get('/users/:userId', {
  params: { userId: '1' },
})

type _test =
  | AssertTrue<
      IsExact<
        Awaited<typeof responseJanuary>['data'],
        ResponseWithVersion<User>
      >
    >
  | AssertTrue<
      IsExact<
        Awaited<typeof responseFebruary>['data'],
        ResponseWithVersion<UserWithTags>
      >
    >
  | AssertTrue<
      IsExact<
        Awaited<typeof responseMarch>['data'],
        ResponseWithVersion<UserWithTags>
      >
    >
