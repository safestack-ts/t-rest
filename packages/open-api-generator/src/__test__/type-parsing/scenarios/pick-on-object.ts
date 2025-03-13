import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'

type User = {
  id: number
  name: string
  email: string
  password: string
  createdAt: Date
  updatedAt: Date
}

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/users').response<{
      users: Pick<User, 'id' | 'name'>[]
    }>()
  )
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {},
    },
    output: {
      kind: 'object',
      properties: {
        users: {
          kind: 'array',
          items: {
            kind: 'object',
            properties: {
              id: { kind: 'number' },
              name: { kind: 'string' },
            },
            required: ['id', 'name'],
          },
        },
      },
      required: ['users'],
    },
    routeMeta: {
      originalPath: '/users',
    },
  },
]
