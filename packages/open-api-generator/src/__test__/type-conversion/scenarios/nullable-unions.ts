import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/nullable-unions')
      .validate(
        z.object({
          body: z.object({
            flag: z.boolean().nullable(),
            choice: z.enum(['a', 'b']).nullable(),
            mixed: z.union([z.string(), z.number()]).nullable(),
            boolOrString: z.union([z.boolean(), z.string()]),
          }),
        })
      )
      .response<{ ok: boolean }>()
  )
  .build()
