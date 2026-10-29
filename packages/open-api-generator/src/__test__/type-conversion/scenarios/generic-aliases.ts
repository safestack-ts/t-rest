import { BagOfRoutes, Route } from '@t-rest/core'

type Nullable<T> = T | null
type List<T> = T[]
type Paginated<T> = { items: T[]; total: number }

type User = { id: string; name: string }

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/generic-aliases').response<{
      nullableString: Nullable<string>
      numbers: List<number>
      users: Paginated<User>
    }>()
  )
  .build()
