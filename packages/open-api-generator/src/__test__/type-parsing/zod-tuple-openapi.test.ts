import path from 'path'
import {
  getOpenAPI3Spec,
  parseBagOfRoutes,
} from '../../utils/parse-bag-of-routes.js'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

describe('OpenAPI Generation for Zod tuples', () => {
  test('generates fixed-length array schema for z.tuple()', () => {
    const modulePath = path.join(__dirname, 'scenarios', 'zod-tuple.ts')
    const results = parseBagOfRoutes(modulePath, tsConfigPath)

    const routes = Array.from(results.values())
    expect(routes).toHaveLength(1)

    const inputSpec = getOpenAPI3Spec(routes[0].input!)
    const tupleSpec =
      inputSpec.spec.properties.body.properties.coordinates
    const dateRangeSpec =
      inputSpec.spec.properties.body.properties.insertionDateRange

    expect(tupleSpec).toEqual({
      type: 'array',
      items: [{ type: 'number' }, { type: 'number' }, { type: 'string' }],
      minItems: 3,
      maxItems: 3,
    })

    expect(dateRangeSpec).toEqual({
      type: 'array',
      items: [
        { type: 'string', format: 'date-time' },
        { type: 'string', format: 'date-time' },
      ],
      minItems: 2,
      maxItems: 2,
    })
    expect(inputSpec.components).not.toHaveProperty('Date')
  })
})
