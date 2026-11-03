import { securityScheme } from '@t-rest/core'

export const bearer = securityScheme('bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

export const apiKey = securityScheme('apiKey', {
  type: 'apiKey',
  in: 'header',
  name: 'x-api-key',
  description: 'Keys for server-to-server calls',
})

export const oauth = securityScheme('oauth', {
  type: 'oauth2',
  flows: {
    authorizationCode: {
      authorizationUrl: 'https://auth.shop.dev/authorize',
      tokenUrl: 'https://auth.shop.dev/token',
      scopes: {
        'orders:read': 'Read orders',
        'orders:write': 'Create and cancel orders',
      },
    },
  },
})
