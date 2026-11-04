import Ajv2020 from 'ajv/dist/2020'
import AjvDraft04 from 'ajv-draft-04'
import { serialize } from '../output/serialize.js'
import { CAPABILITIES, Target } from './capabilities.js'
import type { OpenAPIDocument, WrittenDocument } from './document.js'

/** The YAML document, preceded by one comment line per diagnostic. */
export const documentSnapshot = ({ document, diagnostics }: WrittenDocument) =>
  [
    ...diagnostics.map(
      ({ code, at }) => `# ${code}${at.pointer ? ` ${at.pointer}` : ''}\n`
    ),
    serialize(document, 'yaml'),
  ].join('')

// Ajv checks a discriminator's members but does not support `mapping`.
const withoutMappings = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (key, entry) =>
      key === 'mapping' ? undefined : entry
    )
  )

/** A validator of `schema`, whose refs point into `document`'s components, with the dialect of `target`. */
export const instanceValidator = (
  document: OpenAPIDocument,
  target: Target,
  schema: object
) => {
  const options = { strict: false, validateFormats: false, discriminator: true }
  const ajv =
    CAPABILITIES[target].nullable === 'nullable-keyword'
      ? new AjvDraft04(options)
      : new Ajv2020(options)
  ajv.addSchema(
    withoutMappings({ components: document.components, schema }) as object,
    'document'
  )
  return ajv.compile({ $ref: 'document#/schema' })
}
