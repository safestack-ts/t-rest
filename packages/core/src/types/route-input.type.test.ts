import { z } from 'zod'
import { BagOfRoutes } from '../classes/core/bag-of-routes'
import { Route } from '../classes/core/route'
import { RouteInput, RouteOutput } from './route-input-output'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import { Versioning } from '../enums/versioning'
import { versionHistory } from '../utils/dx/demo-bag-of-routes'
type User = {
  id: string
  email: string
}

type UserWithTags = User & {
  tags: string[]
}

namespace _WithoutVersioning {
  const bagOfRoutesUsers = BagOfRoutes.withoutVersioning()
    .addRoute(
      Route.post('/users/:userId/tags')
        .validate(
          z.object({
            params: z.object({
              userId: z.string(),
            }),
            body: z.object({
              tags: z.array(z.string()),
            }),
          })
        )
        .response<User[]>()
    )
    .build()

  type Bag = typeof bagOfRoutesUsers

  type CreateUserTagRouteInput = RouteInput<Bag, 'POST', '/users/:userId/tags'>
  type CreateUserTagRouteOutput = RouteOutput<
    Bag,
    'POST',
    '/users/:userId/tags'
  >

  type _test =
    | AssertTrue<
        IsExact<
          CreateUserTagRouteInput,
          {
            params: { userId: string }
            body: { tags: string[] }
          }
        >
      >
    | AssertTrue<IsExact<CreateUserTagRouteOutput, User[]>>
}

namespace _WithVersioning {
  const bagOfRoutesUsers = BagOfRoutes.withVersioning(
    Versioning.DATE,
    versionHistory
  )
    .addRoute(
      Route.version('2024-01-01')
        .post('/users/:userId/tags')
        .validate(
          z.object({
            params: z.object({
              userId: z.string(),
            }),
            body: z.object({
              tags: z.array(z.string()),
            }),
          })
        )
        .response<User[]>()
    )
    .addRoute(
      Route.version('2024-02-01')
        .post('/users/:userId/tags')
        .validate(
          z.object({
            params: z.object({
              userId: z.string(),
            }),
            body: z.object({
              tags: z.array(z.string()),
              checkDuplicates: z.boolean(),
            }),
          })
        )
        .response<UserWithTags[]>()
    )
    .build()

  type Bag = typeof bagOfRoutesUsers

  type CreateUserTagRouteInputV1 = RouteInput<
    Bag,
    'POST',
    '/users/:userId/tags',
    '2024-01-01'
  >
  type CreateUserTagRouteOutputV1 = RouteOutput<
    Bag,
    'POST',
    '/users/:userId/tags',
    '2024-01-01'
  >

  type CreateUserTagRouteInputV2 = RouteInput<
    Bag,
    'POST',
    '/users/:userId/tags',
    '2024-02-01'
  >
  type CreateUserTagRouteOutputV2 = RouteOutput<
    Bag,
    'POST',
    '/users/:userId/tags',
    '2024-02-01'
  >

  type _test =
    | AssertTrue<
        IsExact<
          CreateUserTagRouteInputV1,
          { params: { userId: string }; body: { tags: string[] } }
        >
      >
    | AssertTrue<
        IsExact<
          CreateUserTagRouteInputV2,
          {
            params: { userId: string }
            body: { tags: string[]; checkDuplicates: boolean }
          }
        >
      >
    | AssertTrue<IsExact<CreateUserTagRouteOutputV1, User[]>>
    | AssertTrue<IsExact<CreateUserTagRouteOutputV2, UserWithTags[]>>
}
