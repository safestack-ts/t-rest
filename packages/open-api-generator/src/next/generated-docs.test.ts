import { expect, test } from 'vitest'
import { renderDiagnosticsReference } from './diagnostics/render.js'
import { apiModelJsonSchema } from './model/document-schema.js'
import { renderApiModelReference } from './model/render.js'

const docs = (file: string) => `../../../../docs/open-api-generator/${file}`

test('diagnostics.md is generated from the diagnostics table', async () => {
  await expect(renderDiagnosticsReference()).toMatchFileSnapshot(
    docs('diagnostics.md')
  )
})

test('api-model.md is generated from the document schema', async () => {
  await expect(renderApiModelReference()).toMatchFileSnapshot(
    docs('api-model.md')
  )
})

test('api-model.v1.schema.json is generated from the document schema', async () => {
  await expect(
    `${JSON.stringify(apiModelJsonSchema, null, 2)}\n`
  ).toMatchFileSnapshot('../../schema/api-model.v1.schema.json')
})
