import { BagOfRoutes, Route, ze } from '@t-rest/core'
import { User } from '@t-rest/testing-utilities'
import { z } from 'zod'

BagOfRoutes.withoutVersioning().addRoute(
  Route.get('/users/:userId')
    .validate(z.object({ params: z.object({ userIds: ze.parseInteger() }) }))
    .response<User>()
)
