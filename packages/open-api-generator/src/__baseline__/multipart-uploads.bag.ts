import { BagOfRoutes, json, Route } from '@t-rest/core'
import { z } from 'zod'

export type Upload = {
  id: string
  size: number
}

export type UploadFailure = {
  error: string
  field: string | null
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/documents')
      .multipart({
        files: {
          document: { required: true },
          attachments: { multiple: true },
        },
      })
      .validate(
        z.object({
          body: z.object({ title: z.string(), note: z.string().optional() }),
        })
      )
      .responses({ 201: json<Upload>(), 422: json<UploadFailure>() })
  )
  .addRoute(
    Route.put('/avatar')
      .multipart({ files: { avatar: { required: true } } })
      .response<Upload>()
  )
  .addRoute(
    Route.patch('/documents/:documentId')
      .multipart({ json: true })
      .validate(
        z.object({
          params: z.object({ documentId: z.string() }),
          body: z.object({ title: z.string() }),
        })
      )
      .response<Upload>()
  )
  .build()
