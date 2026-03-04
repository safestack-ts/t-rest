import { parseBagOfRoutes } from '../../utils/parse-bag-of-routes.js'
import { getOpenAPI3Spec } from '../../utils/parse-bag-of-routes.js'
import path from 'path'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

describe('OpenAPI Generation for Union of Transformed Objects', () => {
  test('should generate correct OpenAPI spec for union of transformed Zod objects', () => {
    const modulePath = path.join(
      __dirname,
      'scenarios',
      'union-of-transformed-objects.ts'
    )
    const results = parseBagOfRoutes(modulePath, tsConfigPath)

    const routes = Array.from(results.values())
    expect(routes).toHaveLength(1)

    const route = routes[0]

    // Get the OpenAPI spec for the request body
    const requestBodySpec = getOpenAPI3Spec(route.input!)

    console.log('Generated OpenAPI spec for request body:')
    console.log(JSON.stringify(requestBodySpec, null, 2))

    // Get the body property which contains the union
    const bodyProperty = requestBodySpec.spec.properties.body

    // Check if it's a oneOf (union) structure
    expect(bodyProperty).toHaveProperty('oneOf')
    expect(bodyProperty.oneOf).toHaveLength(7)

    // Verify that union members are properly inlined (no refs)
    const refs = bodyProperty.oneOf.filter((item: any) => item.$ref)
    expect(refs).toHaveLength(0)

    console.log('Total refs:', refs.length)
    console.log(
      'Components defined:',
      Object.keys(requestBodySpec.components || {})
    )

    // Verify each union member has unique properties
    const unionMembers = bodyProperty.oneOf

    // Check first member (SWISSTRAVELPASS)
    expect(unionMembers[0].properties).toHaveProperty('cardId')
    expect(unionMembers[0].properties).toHaveProperty('keycardType')
    expect(unionMembers[0].properties.keycardType.enum).toEqual([
      'SWISSTRAVELPASS',
    ])

    // Check second member (EUINTERRAIL)
    expect(unionMembers[1].properties).toHaveProperty('passId')
    expect(unionMembers[1].properties.keycardType.enum).toEqual(['EUINTERRAIL'])

    // Check third member (SWISSPASS)
    expect(unionMembers[2].properties).toHaveProperty('ausweisId')
    expect(unionMembers[2].properties).toHaveProperty('zip')
    expect(unionMembers[2].properties.keycardType.enum).toEqual(['SWISSPASS'])

    // Check fourth member (SKIDATA)
    expect(unionMembers[3].properties).toHaveProperty('dataCarrierId')
    expect(unionMembers[3].properties.keycardType.enum).toEqual(['SKIDATA'])

    // Check fifth member (AXESS)
    expect(unionMembers[4].properties).toHaveProperty('wtp')
    expect(unionMembers[4].properties.keycardType.enum).toEqual(['AXESS'])

    // Check sixth member (LICENSEPLATE)
    expect(unionMembers[5].properties).toHaveProperty('licensePlate')
    expect(unionMembers[5].properties).toHaveProperty('countryCode')
    expect(unionMembers[5].properties.keycardType.enum).toEqual([
      'LICENSEPLATE',
    ])

    // Check seventh member (FERATEL)
    expect(unionMembers[6].properties).toHaveProperty('cardId')
    expect(unionMembers[6].properties.keycardType.enum).toEqual(['FERATEL'])

    // Verify no __object component is created
    expect(Object.keys(requestBodySpec.components || {})).not.toContain(
      '__object'
    )
  })
})
