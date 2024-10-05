import { BagOfRoutes, Route, ze } from '@typed-rest/core'
import { User } from '@typed-rest/testing-utilities'
import { z } from 'zod'

BagOfRoutes.withoutVersioning().addRoute(
  Route.get('/users/:userId')
    // @ts-expect-error
    .validate(z.object({ params: z.object({ userIds: ze.parseInteger() }) }))
    .response<User>()
)
