import { BagOfRoutes, json, Route } from '@t-rest/core'
import { TypedExpressApplication } from '@t-rest/express-server'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import Express from 'express'
import { SupertestAdapter } from '../classes/supertest-adapter.js'

type Invoice = { id: number }
type Invalid = { issues: string[] }

const adapter = SupertestAdapter.withoutVersioning(
  TypedExpressApplication.withoutVersioning(
    Express(),
    BagOfRoutes.withoutVersioning()
      .addRoute(Route.get('/invoices/:id').response<Invoice>())
      .build()
      .withDefaultResponses({ 400: json<Invalid>() })
  )
)

export const test = async () => {
  const response = await adapter.get('/invoices/:id', {})
  type _declaredStatuses = AssertTrue<
    IsExact<(typeof response)['status'], 200 | 400>
  >
  if (response.status === 400) {
    type _defaultBody = AssertTrue<IsExact<typeof response.body, Invalid>>
  }
}
