import { BagOfRoutes } from '@t-rest/core'
import { expect } from 'vitest'
import { parseApiModel } from '../model/document-schema.js'
import type { DefKey, Operation } from '../model/types.js'
import { BagModel, buildBagModel } from './bag-model.js'
import type { BagModelConfig } from './config.js'

/** Builds the bag model and checks that it is a valid `ApiModelDocument`. */
export const build = (
  bag: BagOfRoutes<any, any, any>,
  config?: BagModelConfig
): BagModel & { operation: (key: string) => Operation<DefKey> } => {
  const built = buildBagModel(bag, config)
  expect(() => parseApiModel(built.model)).not.toThrow()

  return {
    ...built,
    operation: (key) => {
      const operation = built.model.operations.find((op) => op.key === key)
      expect(operation, `operation ${key}`).toBeDefined()
      return operation as Operation<DefKey>
    },
  }
}

export const codes = ({ diagnostics }: Pick<BagModel, 'diagnostics'>) =>
  diagnostics.map(({ code, at, data }) => ({ code, at, data }))

/** The golden file of a scenario, reviewed like code. */
export const golden = (value: unknown, scenario: string) =>
  expect(`${JSON.stringify(value, null, 2)}\n`).toMatchFileSnapshot(
    `__golden__/${scenario}.json`
  )
