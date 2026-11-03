import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag } from './bag.js'

export const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API' },
  specs: [
    { target: '3.1', output: 'openapi/internal.yaml' },
    {
      target: '3.1',
      output: 'openapi/public.yaml',
      filter: (route) => route.meta.public === true,
    },
  ],
})
