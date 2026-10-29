import { describe, expect, test } from 'vitest'
import { parseBagOfRoutes } from '../../utils/parse-bag-of-routes.js'
import path from 'path'
import fs from 'fs'
import { isEqual } from 'lodash'

const tsConfigPath = path.join(__dirname, '../../../', 'tsconfig.json')

/**
 * Test case definition type
 */
interface RouteTestCase {
  name: string
  modulePath: string
}

/**
 * Helper to run a single test case
 */
const runTestCase = (testCase: RouteTestCase) => {
  test(testCase.name, async () => {
    const { expectedResult } = await import(testCase.modulePath)
    const results = parseBagOfRoutes(testCase.modulePath, tsConfigPath)

    if (!isEqual(Array.from(results.values()), expectedResult)) {
      console.log(JSON.stringify(Array.from(results.values()), null, 2))
    }

    expect(Array.from(results.values())).toEqual(expectedResult)
  })
}

const filter = null //'arrays'

describe('BagOfRoutes Parsing', () => {
  const scenarioFilePaths = fs.readdirSync(path.join(__dirname, 'scenarios'))

  scenarioFilePaths.forEach((filePath) => {
    if (filter && !filePath.startsWith(filter)) {
      return
    }

    const name = path.basename(filePath, '.ts').replace(/-/g, ' ')
    const modulePath = path.join(__dirname, 'scenarios', filePath)

    runTestCase({
      name,
      modulePath,
    })
  })
})
