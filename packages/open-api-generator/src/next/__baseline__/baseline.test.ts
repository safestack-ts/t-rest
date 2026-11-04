import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, describe, expect, test } from 'vitest'
import YAML from 'yaml'
import { BagOfRoutes } from '@t-rest/core'
import { OpenAPIGenerator } from '../../classes/open-api-generator.js'
import { OpenAPISpec } from '../../classes/open-api-spec.js'
import { expectValidOpenAPI } from '../verification/expect-valid-openapi.js'
import multipartUploads from './multipart-uploads.bag.js'
import typeVariety from './type-variety.bag.js'
import versionedCatalog from './versioned-catalog.bag.js'

// Today's generator output for the fixture bags. The new writer's 3.0 output is
// compared against these files, so they change only when the old generator does.

const tsConfigPath = path.join(__dirname, '../../../tsconfig.json')
const metaData = { title: 'Baseline', description: 'Baseline fixture' }

const baselines: {
  fixture: string
  bag: BagOfRoutes<any, any, any>
  version?: string
}[] = [
  {
    fixture: 'versioned-catalog',
    bag: versionedCatalog,
    version: '2024-01-01',
  },
  {
    fixture: 'versioned-catalog',
    bag: versionedCatalog,
    version: '2025-01-01',
  },
  { fixture: 'multipart-uploads', bag: multipartUploads },
  { fixture: 'type-variety', bag: typeVariety },
]

const outputDirs: string[] = []

afterAll(() =>
  Promise.all(
    outputDirs.map((dir) => fs.rm(dir, { recursive: true, force: true }))
  )
)

describe.each(baselines)('$fixture $version', ({ fixture, bag, version }) => {
  const name = [fixture, version, '3.0.yaml'].filter(Boolean).join('.')

  test('matches the committed baseline and is valid OpenAPI 3.0', async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baseline-'))
    outputDirs.push(outputDir)

    await OpenAPIGenerator.generate([
      {
        spec: version
          ? OpenAPISpec.ofVersion(bag, version).withMetaData(metaData)
          : OpenAPISpec.of(bag).withMetaData({ ...metaData, version: '1.0.0' }),
        outputFile: name,
        outputDir,
        entry: path.join(__dirname, `${fixture}.bag.ts`),
        tsConfigPath,
      },
    ])

    const yaml = await fs.readFile(path.join(outputDir, name), 'utf8')

    expectValidOpenAPI(YAML.parse(yaml), '3.0')
    await expect(yaml).toMatchFileSnapshot(name)
  })
})
