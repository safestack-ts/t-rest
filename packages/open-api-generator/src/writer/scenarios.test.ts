import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { parseApiModel } from '../model/document-schema.js'
import type { ApiModel, ComponentName, DefKey } from '../model/types.js'
import { assignNames } from '../naming/assign-names.js'
import { expectValidOpenAPI } from '../verification/expect-valid-openapi.js'
import { TARGETS } from './capabilities.js'
import { writeDocument } from './document.js'
import { documentSnapshot } from './testing.js'

// The reviewed model goldens of the route and naming stages, written for every target.

const goldens = (stage: string) => {
  const dir = path.join(__dirname, '..', stage, '__golden__')
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      scenario: path.basename(file, '.json'),
      model: parseApiModel(
        JSON.parse(readFileSync(path.join(dir, file), 'utf8'))
      ),
    }))
}

const scenarios = [
  ...goldens('route').map(({ scenario, model }) => ({
    scenario,
    model: assignNames(model as ApiModel<DefKey>).model,
  })),
  ...goldens('naming').map(({ scenario, model }) => ({
    scenario,
    model: model as ApiModel<ComponentName>,
  })),
]

const info = { title: 'Scenario', version: '1.0.0' }

describe.each(scenarios)('$scenario', ({ scenario, model }) => {
  test.each(TARGETS)(
    'is valid OpenAPI %s and matches its snapshot',
    async (target) => {
      const written = writeDocument(model, target, { info })

      expectValidOpenAPI(written.document, target)
      await expect(documentSnapshot(written)).toMatchFileSnapshot(
        `__snapshots__/${scenario}.${target}.yaml`
      )
    }
  )
})
