import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag } from './routes.js'
import { bearer, oauth } from './schemes.js'

export const build = buildOpenAPI({
  bag,
  info: { title: 'Orders API' },
  // routes without meta.security
  security: [[bearer]],
  // documented in every spec, also when no route of the spec uses it
  securitySchemes: [oauth],
  specs: [{ target: '3.1', output: 'openapi/orders.yaml' }],
})
