import { parseBagOfRoutes } from '../../utils/parse-bag-of-routes'
import path from 'path'
import fs from 'fs'
import { isEqual } from 'lodash'

/**
 * Test case definition type
 */
interface RouteTestCase {
  name: string
  modulePath: string
  expectedOutput: any
}

/**
 * Helper to run a single test case
 */
const runTestCase = (testCase: RouteTestCase) => {
  test(testCase.name, () => {
    const results = parseBagOfRoutes(testCase.modulePath)

    if (!isEqual(Array.from(results.values()), testCase.expectedOutput)) {
      console.log(JSON.stringify(Array.from(results.values()), null, 2))
    }

    expect(Array.from(results.values())).toEqual(testCase.expectedOutput)
  })
}

const filter = null //'zod-branded-utility'

describe('BagOfRoutes Parsing', () => {
  const scenarioFilePaths = fs.readdirSync(path.join(__dirname, 'scenarios'))

  scenarioFilePaths.forEach((filePath) => {
    if (filter && !filePath.startsWith(filter)) {
      return
    }

    const scenario = require(`./scenarios/${filePath}`)

    const name = path.basename(filePath, '.ts').replace(/-/g, ' ')
    const modulePath = path.join(__dirname, 'scenarios', filePath)

    runTestCase({
      name,
      modulePath,
      expectedOutput: scenario.expectedResult,
    })
  })
})
