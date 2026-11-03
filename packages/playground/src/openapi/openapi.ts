import path from 'path'
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag, bearer } from './bag.js'

/** The internal 3.0 documents of every version and the public 3.1 document. */
export const buildShopAPI = (outputDir: string) =>
  buildOpenAPI({
    bag,
    info: { title: 'Shop API', description: 'Products and their stock' },
    tags: [
      { name: 'catalog', description: 'Products and their stock' },
      { name: 'admin', description: 'Internal tools' },
    ],
    security: [[bearer]],
    specs: [
      {
        versions: 'all',
        target: '3.0',
        output: path.join(outputDir, 'internal-{version}.yaml'),
      },
      {
        target: '3.1',
        output: path.join(outputDir, 'public.yaml'),
        filter: (route) => route.meta.public === true,
      },
    ],
  })
