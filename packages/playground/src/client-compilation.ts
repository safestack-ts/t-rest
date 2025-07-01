import { AxiosHTTPAdapter, RESTClient } from '@t-rest/client'
import { BagOfRoutes, Route, VersionHistory, Versioning } from '@t-rest/core'
import axios from 'axios'
import { z } from 'zod'

// Version history for the User API
export const versionHistory = VersionHistory(['2024-01-01'] as const)

// User Zod schema - preferred way to define types as per guidelines
const userSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// Inferred type from Zod schema
type User = z.infer<typeof userSchema>

// Request schemas for different operations
const createUserSchema = z.object({
  body: userSchema.omit({ id: true, createdAt: true, updatedAt: true }),
})

const updateUserSchema = z.object({
  params: z.object({
    userId: z.number().int().min(1),
  }),
  body: userSchema
    .partial()
    .omit({ id: true, createdAt: true, updatedAt: true }),
})

const getUserSchema = z.object({
  params: z.object({
    userId: z.number().int().min(1),
  }),
})

const deleteUserSchema = z.object({
  params: z.object({
    userId: z.number().int().min(1),
  }),
})

const getUsersSchema = z.object({
  query: z
    .object({
      page: z.number().int().min(1).default(1).optional(),
      limit: z.number().int().min(1).max(100).default(10).optional(),
      search: z.string().optional(),
    })
    .optional(),
})

// Response types
type UserResponse = User
type UsersListResponse = {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
type CreateUserResponse = {
  user: User
  message: string
}
type UpdateUserResponse = {
  user: User
  message: string
}
type DeleteUserResponse = {
  message: string
}

// Demo bag of routes with basic CRUD operations for User model (with versioning)
export const userRoutesBag = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  // GET /users - List all users with pagination and search
  .addRoute(
    Route.version('2024-01-01')
      .get('/users')
      .validate(getUsersSchema)
      .response<UsersListResponse>()
  )
  // GET /users/:userId - Get a specific user by ID
  .addRoute(
    Route.version('2024-01-01')
      .get('/users/:userId')
      .validate(getUserSchema)
      .response<UserResponse>()
  )
  // POST /users - Create a new user
  .addRoute(
    Route.version('2024-01-01')
      .post('/users')
      .validate(createUserSchema)
      .response<CreateUserResponse>()
  )
  // PUT /users/:userId - Update a user (full update)
  .addRoute(
    Route.version('2024-01-01')
      .put('/users/:userId')
      .validate(updateUserSchema)
      .response<UpdateUserResponse>()
  )
  // PATCH /users/:userId - Partial update of a user
  .addRoute(
    Route.version('2024-01-01')
      .patch('/users/:userId')
      .validate(updateUserSchema)
      .response<UpdateUserResponse>()
  )
  // DELETE /users/:userId - Delete a user
  .addRoute(
    Route.version('2024-01-01')
      .delete('/users/:userId')
      .validate(deleteUserSchema)
      .response<DeleteUserResponse>()
  )
  .build()

const httpAdapter = new AxiosHTTPAdapter(axios.create())

export const userClient = RESTClient.withVersioning(
  userRoutesBag,
  '2024-01-01',
  httpAdapter,
  null as any
)
