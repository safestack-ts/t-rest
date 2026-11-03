import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, test } from 'vitest'
import YAML from 'yaml'
import { parseApiModel } from '../model/document-schema.js'
import { pipeline } from '../spec/testing.js'
import { TARGETS } from '../writer/capabilities.js'
import { writeDocument } from '../writer/document.js'
import { varietyBag, varietyOptions } from '../writer/variety.js'
import { outputFiles, OutputSpec, sidecarPath, writeFiles } from './files.js'
import { formatOf } from './serialize.js'

const { model } = pipeline(varietyBag).spec()
const { document } = writeDocument(model, TARGETS[0], varietyOptions)
const spec = (output: string): OutputSpec => ({
  output,
  format: formatOf(output) ?? 'yaml',
  document,
  model,
})

const dirs: string[] = []
const tempDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'output-'))
  dirs.push(dir)
  return dir
}
afterEach(() =>
  Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })))
)

describe('outputFiles', () => {
  test('the format follows the extension', () => {
    expect(['a.yaml', 'a.YML', 'a.json', 'a.txt', 'a'].map(formatOf)).toEqual([
      'yaml',
      'yaml',
      'json',
      undefined,
      undefined,
    ])
  })

  test('each spec gets its document and its own model as a sidecar', () => {
    const { files, diagnostics } = outputFiles([
      spec('openapi/public.yaml'),
      spec('openapi/internal.json'),
    ])

    expect(diagnostics).toEqual([])
    expect(
      files.map((file) => path.relative(process.cwd(), file.path))
    ).toEqual([
      'openapi/public.yaml',
      'openapi/public.api-model.json',
      'openapi/internal.json',
      'openapi/internal.api-model.json',
    ])
    expect(YAML.parse(files[0].content)).toEqual(document)
    expect(JSON.parse(files[2].content)).toEqual(document)
    expect(parseApiModel(JSON.parse(files[1].content))).toEqual(model)
  })

  test('two outputs with one sidecar collide', () => {
    const { diagnostics } = outputFiles([spec('api.yaml'), spec('api.json')])

    expect(diagnostics.map(({ code, data }) => [code, data])).toEqual([
      [
        'output/path-collision',
        {
          path: path.resolve(sidecarPath('api.yaml')),
          outputs: ['api.yaml', 'api.json'],
        },
      ],
    ])
  })

  test('paths that differ only in case collide', () => {
    const { diagnostics } = outputFiles([spec('API.yaml'), spec('api.yml')])

    expect(diagnostics.map(({ data }) => data)).toEqual([
      {
        path: path.resolve(sidecarPath('API.yaml')),
        outputs: ['API.yaml', 'api.yml'],
      },
    ])
  })

  test('one output given twice is named once', () => {
    const { diagnostics } = outputFiles([spec('api.yaml'), spec('api.yaml')])

    expect(diagnostics.map(({ data }) => data)).toEqual([
      { path: path.resolve('api.yaml'), outputs: ['api.yaml'] },
      { path: path.resolve(sidecarPath('api.yaml')), outputs: ['api.yaml'] },
    ])
  })
})

describe('writeFiles', () => {
  test('writes into new directories without leaving temp files, and again over them', async () => {
    const dir = await tempDir()
    const files = outputFiles([spec(path.join(dir, 'nested/api.yaml'))]).files

    await writeFiles(files)
    await writeFiles(files)

    expect((await readdir(path.join(dir, 'nested'))).sort()).toEqual([
      'api.api-model.json',
      'api.yaml',
    ])
    expect(await readFile(files[0].path, 'utf8')).toBe(files[0].content)
  })

  test('writes nothing when a file cannot be staged', async () => {
    const dir = await tempDir()
    await writeFile(path.join(dir, 'blocked'), '')
    const files = outputFiles([
      spec(path.join(dir, 'api.yaml')),
      spec(path.join(dir, 'blocked/api.yaml')),
    ]).files

    await expect(writeFiles(files)).rejects.toThrow()
    expect(await readdir(dir)).toEqual(['blocked'])
  })
})
