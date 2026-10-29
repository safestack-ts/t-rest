import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'

type UserId = string & { readonly __tag: 'UserId' }

type Address = { city: string }
const addressSchema: z.ZodType<Address> = z.object({ city: z.string() })

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/intersections').response<{
      first: UserId
      second: UserId
    }>()
  )
  .addRoute(
    Route.post('/params/:address')
      .validate(
        z.object({
          params: z.object({ address: addressSchema }),
          body: z.object({ address: addressSchema }),
        })
      )
      .response<{ ok: boolean }>()
  )
  .build()
