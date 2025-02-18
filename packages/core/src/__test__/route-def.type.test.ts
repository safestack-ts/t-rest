import { z } from 'zod'
import { Route } from '../classes/core/route'
import { ze } from '../utils/zod-extensions'

const _routeWithSuperRefineValidator = Route.post('/')
  .validate(
    z
      .object({
        body: z.object({
          name: z.string(),
        }),
      })
      .superRefine((data, ctx) => {
        if (data.body.name === 'John') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
          })
        }
      })
  )
  .response<any>()

const _routeWithFileOnRequest = Route.post('/')
  .validate(
    z.object({
      body: z.object({
        name: z.string(),
      }),
      file: ze.file().optional(),
    })
  )
  .response<any>()

const _routeWithStrictObjectValidator = Route.post('/')
  .validate(
    z.object({
      body: z.object({
        name: z.string(),
      }),
      params: z.strictObject({
        personId: ze.parseInteger(),
      }),
    })
  )
  .response<any>()
