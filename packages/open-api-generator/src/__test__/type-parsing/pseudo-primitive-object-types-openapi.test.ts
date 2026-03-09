import path from 'path'
import { getOpenAPI3Spec, parseBagOfRoutes } from '../../utils/parse-bag-of-routes.js'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

describe('OpenAPI Generation for pseudo-primitive object-like types', () => {
  test('keeps any, unknown and undefined inline instead of creating component refs', () => {
    const modulePath = path.join(
      __dirname,
      'scenarios',
      'pseudo-primitive-object-types.ts'
    )
    const results = parseBagOfRoutes(modulePath, tsConfigPath)

    const routes = Array.from(results.values())
    expect(routes).toHaveLength(1)

    const route = routes[0]
    const inputSpec = getOpenAPI3Spec(route.input!)
    const outputSpec = getOpenAPI3Spec(route.output!)

    expect(Object.keys(inputSpec.components || {})).not.toContain('any')
    expect(Object.keys(inputSpec.components || {})).not.toContain('unknown')
    expect(Object.keys(outputSpec.components || {})).not.toContain('undefined')

    const anyMapAdditionalProperties =
      inputSpec.spec.properties.body.properties.anyMap.additionalProperties
    const unknownMapAdditionalProperties =
      inputSpec.spec.properties.body.properties.unknownMap.additionalProperties

    expect(anyMapAdditionalProperties).toEqual({
      type: 'object',
      properties: {},
    })
    expect(unknownMapAdditionalProperties).toEqual({
      type: 'object',
      properties: {},
    })
    expect(outputSpec.spec).toEqual({
      type: 'object',
      properties: {},
    })
  })
})
