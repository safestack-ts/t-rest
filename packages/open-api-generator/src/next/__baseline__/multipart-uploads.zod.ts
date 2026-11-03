import { z } from 'zod'

export const Upload = z
  .object({ id: z.string(), size: z.number() })
  .meta({ id: 'Upload' })

export const UploadFailure = z
  .object({ error: z.string(), field: z.string().nullable() })
  .meta({ id: 'UploadFailure' })

/** The bag of `multipart-uploads.bag.ts`, every request and JSON response as a zod schema. */
export const routes = {
  'POST /documents': {
    validator: z.object({
      body: z.object({ title: z.string(), note: z.string().optional() }),
    }),
    responses: { 201: Upload, 422: UploadFailure },
  },
  'PUT /avatar': { responses: { 200: Upload } },
  'PATCH /documents/:documentId': {
    validator: z.object({
      params: z.object({ documentId: z.string() }),
      body: z.object({ title: z.string() }),
    }),
    responses: { 200: Upload },
  },
}
