import { TypedIdentity } from '@t-rest/core'
import { z } from 'zod'
import { validateHeader } from './header'

export const validateRouteMeta = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  deprecated: z.boolean().optional(),
  operationId: z.string().optional(),
  externalDocs: z
    .object({
      description: z.string().optional(),
      url: z.string(),
    })
    .optional(),
  servers: z
    .array(
      z.object({
        url: z.string(),
        description: z.string().optional(),
        variables: z
          .record(
            z.object({
              default: z.string(),
              description: z.string().optional(),
              enum: z.array(z.string()).optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),

  headers: z.array(validateHeader).optional(),
})

export type RouteMeta = z.infer<typeof validateRouteMeta>

export const RouteMeta = TypedIdentity<RouteMeta>()
