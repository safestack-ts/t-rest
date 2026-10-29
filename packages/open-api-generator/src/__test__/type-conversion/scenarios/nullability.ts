import { BagOfRoutes, Route } from '@t-rest/core'
import { z } from 'zod'

type Item = { id: string }
type User = { id: string; email: string | null }
type Wrapper<T> = { value: T }
type WithTimestamps = { createdAt: string }

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/nullability')
      .validate(
        z.object({
          body: z.object({
            tags: z.array(z.string().nullable()),
          }),
        })
      )
      .response<{
        items: (Item | null)[]
        user: Omit<User, 'id'>
        picked: Pick<User, 'email'>
        record: Record<string, number | null>
        wrapped: Wrapper<string | null>
        intersection: WithTimestamps & { deletedAt: string | null }
      }>()
  )
  .addRoute(Route.get('/nullable-item').response<Item | null>())
  .build()
