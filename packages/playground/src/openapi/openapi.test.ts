import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { parseApiModel } from '@t-rest/open-api-generator'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { buildShopAPI } from './openapi.js'

let outputDir: string

beforeAll(async () => {
  outputDir = await mkdtemp(path.join(os.tmpdir(), 'shop-api-'))
})
afterAll(() => rm(outputDir, { recursive: true }))

describe('the shop API', () => {
  test('builds without diagnostics', () => {
    expect(buildShopAPI(outputDir).diagnostics).toEqual([])
  })

  test('writes every spec with its model sidecar', async () => {
    await buildShopAPI(outputDir).write()

    expect((await readdir(outputDir)).sort()).toEqual([
      'internal-2024-01-01.api-model.json',
      'internal-2024-01-01.yaml',
      'internal-2025-01-01.api-model.json',
      'internal-2025-01-01.yaml',
      'public.api-model.json',
      'public.yaml',
    ])
    const sidecar = await readFile(
      path.join(outputDir, 'public.api-model.json'),
      'utf8'
    )
    expect(parseApiModel(JSON.parse(sidecar)).operations).toHaveLength(3)
  })

  test.each([
    'internal-2024-01-01.yaml',
    'internal-2025-01-01.yaml',
    'public.yaml',
  ])('%s matches its snapshot', async (file) => {
    await buildShopAPI(outputDir).write()

    await expect(
      await readFile(path.join(outputDir, file), 'utf8')
    ).toMatchFileSnapshot(`__snapshots__/${file}`)
  })
})
