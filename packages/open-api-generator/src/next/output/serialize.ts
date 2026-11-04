import path from 'path'
import YAML from 'yaml'

export type Format = 'yaml' | 'json'

const FORMATS: Readonly<Record<string, Format>> = {
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
}

/** The format an output path asks for by its extension, `undefined` for any other extension. */
export const formatOf = (output: string): Format | undefined =>
  FORMATS[path.extname(output).toLowerCase()]

/** Keeps the key order of `value`, so a deterministic object gives deterministic text. */
export const serialize = (value: unknown, format: Format): string =>
  format === 'json'
    ? `${JSON.stringify(value, null, 2)}\n`
    : YAML.stringify(value, { lineWidth: 0, aliasDuplicateObjects: false })
