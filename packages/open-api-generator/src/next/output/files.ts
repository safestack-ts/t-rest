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

/**
 * Every spec file and its model sidecar, with absolute paths. A path that two
 * specs write is `output/path-collision`; paths are compared ignoring case,
 * since case-insensitive file systems map them to one file.
 */
export const outputFiles = (
  specs: readonly OutputSpec[]
): { files: OutputFile[]; diagnostics: Diagnostic[] } => {
  const owners = new Map<string, { path: string; outputs: string[] }>()
  const files = specs.flatMap(({ output, format, document, model }) =>
    [
      { path: path.resolve(output), content: serialize(document, format) },
      {
        path: path.resolve(sidecarPath(output)),
        content: serialize(model, 'json'),
      },
    ].map((file) => {
      const key = file.path.toLowerCase()
      const owner = owners.get(key) ?? { path: file.path, outputs: [] }
      owners.set(key, { ...owner, outputs: [...owner.outputs, output] })
      return file
    })
  )

  return {
    files,
    diagnostics: [...owners.values()]
      .filter(({ outputs }) => outputs.length > 1)
      .map(({ path: file, outputs }) =>
        diagnostic(
          'output/path-collision',
          {},
          { path: file, outputs: [...new Set(outputs)] }
        )
      ),
  }
}

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
