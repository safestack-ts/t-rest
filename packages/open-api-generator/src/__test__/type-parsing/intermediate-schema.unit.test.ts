import 'jest-extended'
import { parseBagOfRoutes } from '../../utils/parse-bag-of-routes'
import * as path from 'path'

describe('input types', () => {
  test.skip('native enum', () => {
    const routes = parseBagOfRoutes(
      path.resolve(__dirname, './examples/native-enum.example.ts')
    )

    const routeInputSchema = routes.get(['GET', '/orders', ''])?.input

    expect(routeInputSchema).toEqual<typeof routeInputSchema>({
      kind: 'object',
      properties: {
        query: {
          kind: 'object',
          properties: {
            orderStatus: {
              kind: 'enum',
              values: ['PENDING', 'SHIPPED', 'DELIVERED'],
              name: 'OrderStatus',
              //name: expect.toBeString(),
              type: 'string',
            },
          },
        },
      },
    })
  })
})
