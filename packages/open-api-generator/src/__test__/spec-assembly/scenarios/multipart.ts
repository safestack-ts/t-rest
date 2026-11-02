import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/uploads')
      .multipart()
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .response<{ id: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/avatar')
      .multipart()
      .response<{ id: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .patch('/uploads')
      .multipart({ json: true })
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .response<{ id: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/documents')
      .multipart({
        files: {
          document: { required: true },
          attachments: { multiple: true },
        },
      })
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .response<{ id: string }>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .put('/avatar')
      .multipart({ files: { avatar: { required: true } } })
      .response<{ id: string }>()
  )
  .build()

export default bagOfRoutes
