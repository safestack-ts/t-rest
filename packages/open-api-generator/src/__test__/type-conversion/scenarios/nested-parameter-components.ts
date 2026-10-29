import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'

type City = { name: string }
type Address = { city: City }

const addressSchema: z.ZodType<Address> = z.object({
  city: z.object({ name: z.string() }),
})

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/addresses/:address')
      .validate(z.object({ params: z.object({ address: addressSchema }) }))
      .response<{ ok: boolean }>()
  )
  .addRoute(Route.get('/addresses').response<Address>())
  .build()
