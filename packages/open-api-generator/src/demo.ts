import { OpenAPISpec } from './classes/open-api-spec'
import { OpenAPIGenerator } from './classes/open-api-generator'
import { NumberType, StringType, UnionType } from './schema/type-schema'
import bagOfRoutes from './bag'
import path from 'path'

const main = async () => {
  const spec = OpenAPISpec.ofVersion(bagOfRoutes, '2024-01-01').withMetaData({
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
    headers: [
      {
        name: 'pratiq-client-id',
        description: 'Global Webshop Client Id',
        required: true,
        type: UnionType({
          types: [StringType(), NumberType()],
        }),
      },
      {
        name: 'pratiq-channel-uuid',
        description: 'UUID of the sales channel',
        required: false,
        type: StringType(),
      },
    ],
  })

  await OpenAPIGenerator.generate([
    {
      spec,
      outputFile: 'openapi.yaml',
      outputDir: 'docs',
      entry: './src/bag.ts',
      tsConfigPath: path.join(__dirname, '../', 'tsconfig.json'),
    },
  ])
}

main().catch(console.error)
