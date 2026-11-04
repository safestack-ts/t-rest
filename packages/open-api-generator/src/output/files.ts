import { randomUUID } from 'crypto'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import path from 'path'
import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import type { ApiModel, ComponentName } from '../model/types.js'
import type { OpenAPIDocument } from '../writer/document.js'
import { Format, serialize } from './serialize.js'

export interface OutputSpec {
  readonly output: string
  readonly format: Format
  readonly document: OpenAPIDocument
  /** The selected and pruned model of this spec, never the whole bag. */
  readonly model: ApiModel<ComponentName>
}

export interface OutputFile {
  readonly path: string
  readonly content: string
}

/** `openapi/public.yaml` -> `openapi/public.api-model.json`. */
export const sidecarPath = (output: string) =>
  path.join(
    path.dirname(output),
    `${path.basename(output, path.extname(output))}.api-model.json`
  )

/** The spec file of `output` and its model sidecar, as absolute paths. */
const pathsOf = (output: string) => [
  path.resolve(output),
  path.resolve(sidecarPath(output)),
]

/**
 * `output/path-collision` for each path that two outputs write. Paths are
 * compared ignoring case, since case-insensitive file systems map them to one
 * file. Needs no serialization, so it runs before any error gating.
 */
export const pathCollisions = (outputs: readonly string[]): Diagnostic[] => {
  const owners = new Map<string, { path: string; outputs: string[] }>()
  for (const output of outputs)
    for (const file of pathsOf(output)) {
      const key = file.toLowerCase()
      const owner = owners.get(key) ?? { path: file, outputs: [] }
      owners.set(key, { ...owner, outputs: [...owner.outputs, output] })
    }

  return [...owners.values()]
    .filter(({ outputs }) => outputs.length > 1)
    .map(({ path: file, outputs }) =>
      diagnostic(
        'output/path-collision',
        {},
        { path: file, outputs: [...new Set(outputs)] }
      )
    )
}

/**
 * Every spec file and its model sidecar, serialized, with absolute paths. Call
 * it only for a build without errors: a partial document can hold values, such
 * as a BigInt example, that do not serialize.
 */
export const outputFiles = (specs: readonly OutputSpec[]): OutputFile[] =>
  specs.flatMap(({ output, format, document, model }) => {
    const [spec, sidecar] = pathsOf(output)
    return [
      { path: spec, content: serialize(document, format) },
      { path: sidecar, content: serialize(model, 'json') },
    ]
  })

/**
 * Stages every file as a temp file in its target directory, then renames each
 * over its target. Atomic per file, not across the set: a crash while renaming
 * leaves some files new and the others old, never a partial file.
 */
export const writeFiles = async (files: readonly OutputFile[]) => {
  const staged: { temp: string; target: string }[] = []
  const discard = () =>
    Promise.all(staged.map(({ temp }) => rm(temp, { force: true })))

  try {
    for (const file of files) {
      await mkdir(path.dirname(file.path), { recursive: true })
      const temp = `${file.path}.${randomUUID()}.tmp`
      staged.push({ temp, target: file.path })
      await writeFile(temp, file.content)
    }
    while (staged.length > 0) {
      const { temp, target } = staged[0]
      await rename(temp, target)
      staged.shift()
    }
  } catch (error) {
    await discard()
    throw error
  }
}
