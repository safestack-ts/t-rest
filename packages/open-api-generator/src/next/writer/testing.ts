import { serialize } from '../output/serialize.js'
import type { WrittenDocument } from './document.js'

/** The YAML document, preceded by one comment line per diagnostic. */
export const documentSnapshot = ({ document, diagnostics }: WrittenDocument) =>
  [
    ...diagnostics.map(
      ({ code, at }) => `# ${code}${at.pointer ? ` ${at.pointer}` : ''}\n`
    ),
    serialize(document, 'yaml'),
  ].join('')
