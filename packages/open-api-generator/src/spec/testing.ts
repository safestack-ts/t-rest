import { BagOfRoutes } from '@t-rest/core'
import { expect } from 'vitest'
import { parseApiModel } from '../model/document-schema.js'
import type { ComponentName, Operation } from '../model/types.js'
import { assignNames, NamingOptions } from '../naming/assign-names.js'
import type { BagModelConfig, RouteView } from '../route/config.js'
import { build } from '../route/golden.js'
import { SelectedSpec, selectSpec, SpecSelection } from './select.js'

/** Bag model, names and spec selection, each result checked by `parseApiModel`. */
export const pipeline = (
  bag: BagOfRoutes<any, any, any>,
  config?: BagModelConfig,
  naming?: NamingOptions
) => {
  const built = build(bag, config)
  const named = assignNames(built.model, naming)
  expect(() => parseApiModel(named.model)).not.toThrow()

  return {
    ...built,
    named,
    /** `filter` sees the route view, like the config's spec filter. */
    spec: (
      selection: Omit<SpecSelection, 'filter'> & {
        filter?: (route: RouteView) => boolean
      } = {}
    ): SelectedSpec & {
      operation: (key: string) => Operation<ComponentName>
    } => {
      const { filter, ...rest } = selection
      const selected = selectSpec(named.model, {
        ...rest,
        ...(filter && {
          filter: (operation) =>
            filter(built.routes.get(operation.key) as RouteView),
        }),
      })
      expect(() => parseApiModel(selected.model)).not.toThrow()
      return {
        ...selected,
        operation: (key) => {
          const found = selected.model.operations.find((op) => op.key === key)
          expect(found, `operation ${key}`).toBeDefined()
          return found as Operation<ComponentName>
        },
      }
    },
  }
}

export const typeNames = (model: { types: object }) => Object.keys(model.types)
