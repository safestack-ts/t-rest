import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

// Version history for the User API
export const versionHistory = VersionHistory([
  '2024-01-01',
  '2024-02-01',
  '2024-03-01',
] as const)

// V1 User schema (basic)
const userSchemaV1 = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
})

// V2 User schema (added email)
const userSchemaV2 = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
  email: z.string().email(),
})

// V3 User schema (added timestamps and optional profile)
const userSchemaV3 = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  profile: z
    .object({
      avatar: z.string().url().optional(),
      bio: z.string().optional(),
      location: z.string().optional(),
    })
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Inferred types
type UserV1 = z.infer<typeof userSchemaV1>
type UserV2 = z.infer<typeof userSchemaV2>
type UserV3 = z.infer<typeof userSchemaV3>

// Request schemas for different versions
const createUserSchemaV1 = z.object({
  body: userSchemaV1.omit({ id: true }),
})

const createUserSchemaV2 = z.object({
  body: userSchemaV2.omit({ id: true }),
})

const createUserSchemaV3 = z.object({
  body: userSchemaV3.omit({ id: true, createdAt: true, updatedAt: true }),
})

const userParamsSchema = z.object({
  params: z.object({
    userId: z.number().int().min(1),
  }),
})

const updateUserSchemaV3 = z.object({
  params: z.object({
    userId: z.number().int().min(1),
  }),
  body: userSchemaV3
    .partial()
    .omit({ id: true, createdAt: true, updatedAt: true }),
})

// Response types for different versions
type UserListResponseV1 = { users: UserV1[]; total: number }
type UserListResponseV2 = { users: UserV2[]; total: number }
type UserListResponseV3 = {
  users: UserV3[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  meta: {
    version: string
    timestamp: string
  }
}

type UserResponseV1 = UserV1
type UserResponseV2 = UserV2
type UserResponseV3 = UserV3

// Versioned CRUD routes for User model
export const versionedUserRoutesBag = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  // V1 Routes (2024-01-01) - Basic user management
  .addRoute(
    Route.version('2024-01-01').get('/users').response<UserListResponseV1>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/users/:userId')
      .validate(userParamsSchema)
      .response<UserResponseV1>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .post('/users')
      .validate(createUserSchemaV1)
      .response<UserResponseV1>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .delete('/users/:userId')
      .validate(userParamsSchema)
      .response<{ message: string }>()
  )

  // V2 Routes (2024-02-01) - Added email support
  .addRoute(
    Route.version('2024-02-01').get('/users').response<UserListResponseV2>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .get('/users/:userId')
      .validate(userParamsSchema)
      .response<UserResponseV2>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .post('/users')
      .validate(createUserSchemaV2)
      .response<UserResponseV2>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .put('/users/:userId')
      .validate(
        z.object({
          params: z.object({ userId: z.number().int().min(1) }),
          body: userSchemaV2.omit({ id: true }),
        })
      )
      .response<UserResponseV2>()
  )
  .addRoute(
    Route.version('2024-02-01')
      .delete('/users/:userId')
      .validate(userParamsSchema)
      .response<{ message: string }>()
  )

  // V3 Routes (2024-03-01) - Added profile, timestamps, and enhanced pagination
  .addRoute(
    Route.version('2024-03-01')
      .get('/users')
      .validate(
        z.object({
          query: z
            .object({
              page: z.number().int().min(1).default(1).optional(),
              limit: z.number().int().min(1).max(100).default(10).optional(),
              search: z.string().optional(),
              includeProfile: z.boolean().default(false).optional(),
            })
            .optional(),
        })
      )
      .response<UserListResponseV3>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .get('/users/:userId')
      .validate(
        z.object({
          params: z.object({ userId: z.number().int().min(1) }),
          query: z
            .object({
              includeProfile: z.boolean().default(true).optional(),
            })
            .optional(),
        })
      )
      .response<UserResponseV3>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .post('/users')
      .validate(createUserSchemaV3)
      .response<UserResponseV3>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .put('/users/:userId')
      .validate(updateUserSchemaV3)
      .response<UserResponseV3>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .patch('/users/:userId')
      .validate(updateUserSchemaV3)
      .response<UserResponseV3>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .delete('/users/:userId')
      .validate(userParamsSchema)
      .response<{ message: string; deletedAt: string }>()
  )

  // V3 Additional routes - Profile management
  .addRoute(
    Route.version('2024-03-01')
      .put('/users/:userId/profile')
      .validate(
        z.object({
          params: z.object({ userId: z.number().int().min(1) }),
          body: userSchemaV3.shape.profile.unwrap(),
        })
      )
      .response<UserResponseV3>()
  )
  .addRoute(
    Route.version('2024-03-01')
      .delete('/users/:userId/profile')
      .validate(userParamsSchema)
      .response<UserResponseV3>()
  )
  .build()

export default versionedUserRoutesBag

// Type exports
export type {
  UserV1,
  UserV2,
  UserV3,
  UserResponseV1,
  UserResponseV2,
  UserResponseV3,
  UserListResponseV1,
  UserListResponseV2,
  UserListResponseV3,
}

export {
  userSchemaV1,
  userSchemaV2,
  userSchemaV3,
  createUserSchemaV1,
  createUserSchemaV2,
  createUserSchemaV3,
}
