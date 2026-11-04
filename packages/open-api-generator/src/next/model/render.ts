import type { z } from 'zod'
import { apiModelJsonSchema } from './document-schema.js'
import { MODEL_VERSION, MODEL_VERSION_HISTORY } from './version-history.js'

type JsonSchema = z.core.JSONSchema.JSONSchema

const typeOf = (schema: JsonSchema | boolean | undefined): string => {
  if (
    schema === undefined ||
    typeof schema === 'boolean' ||
    Object.keys(schema).length === 0
  )
    return 'any JSON value'
  if (schema.$ref) {
    const name = schema.$ref.replace('#/$defs/', '')
    return `[${name}](#${name.toLowerCase()})`
  }
  if (schema.const !== undefined) return `\`${JSON.stringify(schema.const)}\``
  if (schema.enum)
    return schema.enum.map((v) => `\`${JSON.stringify(v)}\``).join(' \\| ')
  const alternatives = schema.anyOf ?? schema.oneOf
  if (alternatives) return alternatives.map((s) => typeOf(s)).join(' \\| ')
  if (schema.type === 'array') return `${typeOf(schema.items as JsonSchema)}[]`
  if (
    schema.type === 'object' &&
    schema.additionalProperties &&
    !schema.properties
  )
    return `map of ${typeOf(schema.additionalProperties)}`
  return String(schema.type)
}

const propertiesTable = (schema: JsonSchema): string[] => {
  const required = new Set(schema.required ?? [])
  return [
    '| Field | Type | Required |',
    '| --- | --- | --- |',
    ...Object.entries(schema.properties ?? {}).map(
      ([name, property]) =>
        `| \`${name}\` | ${typeOf(property as JsonSchema)} | ${
          required.has(name) ? 'yes' : 'no'
        } |`
    ),
  ]
}

const variantsOf = (schema: JsonSchema): JsonSchema[] =>
  (schema.oneOf ?? schema.anyOf ?? []).filter(
    (s): s is JsonSchema => typeof s !== 'boolean'
  )

const discriminantOf = (variant: JsonSchema): string => {
  const [name, property] = Object.entries(variant.properties ?? {})[0] ?? []
  return `\`${name}: ${JSON.stringify(
    (property as JsonSchema | undefined)?.const
  )}\``
}

const definitionSection = (name: string, schema: JsonSchema): string[] => {
  const variants = variantsOf(schema)
  const body =
    variants.length > 0
      ? variants.flatMap((variant) => [
          '',
          `### ${discriminantOf(variant)}`,
          '',
          ...propertiesTable(variant),
        ])
      : ['', ...propertiesTable(schema)]
  return ['', `## ${name}`, '', schema.description ?? '', ...body]
}

export const renderApiModelReference = (): string => {
  const schema = apiModelJsonSchema as JsonSchema
  return [
    '# API model format',
    '',
    '<!-- Generated from packages/open-api-generator/src/next/model/document-schema.ts by its docs test. Do not edit. -->',
    '',
    `The generator writes the API model of each spec next to it as \`<spec>.api-model.json\`. This page describes \`modelVersion\` ${MODEL_VERSION}. The JSON Schema is [api-model.v1.schema.json](../../packages/open-api-generator/schema/api-model.v1.schema.json).`,
    '',
    '## Changelog',
    '',
    '| modelVersion | Changes |',
    '| --- | --- |',
    ...MODEL_VERSION_HISTORY.map(
      ({ version, changes }) => `| ${version} | ${changes.join(' ')} |`
    ),
    ...definitionSection('ApiModelDocument', schema),
    ...Object.entries(schema.$defs ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([name, definition]) =>
        definitionSection(name, definition as JsonSchema)
      ),
    '',
  ].join('\n')
}
