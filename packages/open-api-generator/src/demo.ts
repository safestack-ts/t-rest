import { TestBagOfRoutesWithVersioning } from '@t-rest/testing-utilities'
import { OpenAPISpec } from './classes/open-api-spec'
import { OpenAPIGenerator } from './classes/open-api-generator'

const main = async () => {
  const spec = OpenAPISpec.ofVersion(
    TestBagOfRoutesWithVersioning.bagOfRoutes,
    '2024-03-01'
  ).withMetaData({
    title: 'My API',
    description: 'My API description',
    contact: {
      name: 'John Doe',
      url: 'https://example.com',
      email: 'john.doe@example.com',
    },
    servers: [
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'users',
        description: 'Users related operations',
      },
    ],
  })

  await OpenAPIGenerator.generate([
    {
      spec,
      outputFile: 'openapi.yaml',
      outputDir: 'docs',
      entry: './src/bag.ts',
    },
  ])
}

main().catch(console.error)
