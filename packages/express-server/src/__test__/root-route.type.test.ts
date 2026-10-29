import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import Express from 'express'
import { TypedExpressApplication } from '../classes/typed-express-application.js'
import { DateVersionExtractor } from '../types/date-version-extractor.js'
import { ExpressRequest } from '../types/express-type-shortcuts.js'

const rootValidator = z.object({ query: z.object({ q: z.string() }) })

// without versioning
{
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.get('/').validate(rootValidator).response<{ ok: boolean }>()
    )
    .build()

  const app = TypedExpressApplication.withoutVersioning(Express(), bagOfRoutes)

  app.get('/').handle((_request, { query }, response) => {
    const q: string = query.q
    response.json({ ok: q.length > 0 })
  })

  app.get('/').handle((_request, _validation, response) => {
    // @ts-expect-error response type must match the declared root route
    response.json({ ok: 'yes' })
  })
}

// with versioning
{
  const versionHistory = VersionHistory(['2024-01-01'] as const)

  class VersionExtractor implements DateVersionExtractor {
    extractVersion(request: ExpressRequest) {
      return request.header('x-api-version')
    }
    parseDate(version: string) {
      return new Date(version)
    }
  }

  const bagOfRoutes = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .get('/')
        .validate(rootValidator)
        .response<{ ok: boolean }>()
    )
    .build()

  const app = TypedExpressApplication.withVersioning(
    Express(),
    bagOfRoutes,
    versionHistory,
    new VersionExtractor()
  )

  app
    .get('/')
    .version('2024-01-01')
    .handle((_request, { query }, response) => {
      const q: string = query.q
      response.json({ ok: q.length > 0 })
    })

  app
    .get('/')
    .version('2024-01-01')
    .handle((_request, _validation, response) => {
      // @ts-expect-error response type must match the declared root route
      response.json({ ok: 'yes' })
    })
}
