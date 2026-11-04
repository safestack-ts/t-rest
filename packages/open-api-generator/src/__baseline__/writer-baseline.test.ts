import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import YAML from 'yaml'
import { BagOfRoutes } from '@t-rest/core'
import { assignNames } from '../naming/assign-names.js'
import { buildBagModel } from '../route/bag-model.js'
import { selectSpec } from '../spec/select.js'
import { expectValidOpenAPI } from '../verification/expect-valid-openapi.js'
import { writeDocument } from '../writer/document.js'
import { BASELINE_ALLOWLIST } from './allowlist.js'
import multipartUploads from './multipart-uploads.bag.js'
import * as multipartUploadsZod from './multipart-uploads.zod.js'
import { differences, projection, twinBag, TwinRoute } from './projection.js'
import typeVariety from './type-variety.bag.js'
import * as typeVarietyZod from './type-variety.zod.js'
import versionedCatalog from './versioned-catalog.bag.js'
import * as versionedCatalogZod from './versioned-catalog.zod.js'

const baselines: {
  file: string
  bag: BagOfRoutes<any, any, any>
  twin: Readonly<Record<string, TwinRoute>>
  version?: string
}[] = [
  {
    file: 'versioned-catalog.2024-01-01.3.0.yaml',
    bag: versionedCatalog,
    twin: versionedCatalogZod.routes,
    version: '2024-01-01',
  },
  {
    file: 'versioned-catalog.2025-01-01.3.0.yaml',
    bag: versionedCatalog,
    twin: versionedCatalogZod.routes,
    version: '2025-01-01',
  },
  {
    file: 'multipart-uploads.3.0.yaml',
    bag: multipartUploads,
    twin: multipartUploadsZod.routes,
  },
  {
    file: 'type-variety.3.0.yaml',
    bag: typeVariety,
    twin: typeVarietyZod.routes,
  },
]

const covers = (at: string, difference: string) =>
  difference === at || difference.startsWith(`${at}/`)

describe.each(baselines)('$file', ({ file, bag, twin, version }) => {
  test('the 3.0 output of the zod twin differs from the baseline only as allowed', () => {
    const named = assignNames(buildBagModel(twinBag(bag, twin)).model)
    const { document } = writeDocument(
      selectSpec(named.model, { version }).model,
      '3.0',
      { info: { title: 'Baseline', version: version ?? '1.0.0' } }
    )
    const baseline = YAML.parse(
      readFileSync(path.join(__dirname, file), 'utf8')
    )

    expectValidOpenAPI(document, '3.0')
    const found = differences(projection(baseline), projection(document))
    const allowed = BASELINE_ALLOWLIST.filter((entry) => entry.file === file)

    expect(
      found.filter(
        (difference) => !allowed.some(({ at }) => covers(at, difference))
      )
    ).toEqual([])
    expect(
      allowed
        .filter(({ at }) => !found.some((difference) => covers(at, difference)))
        .map(({ at }) => at)
    ).toEqual([])
  })
})
