import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag } from './bag.js'

const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API', description: 'Products and orders' },
  specs: [{ target: '3.1', output: 'openapi/openapi.yaml' }],
})

for (const { severity, code, message } of build.diagnostics) {
  console.log(`${severity} ${code}: ${message}`)
}

// openapi/openapi.yaml and openapi/openapi.api-model.json
await build.write()
