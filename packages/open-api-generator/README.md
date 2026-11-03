# @t-rest/open-api-generator

Generates OpenAPI 3.0, 3.1 and 3.2 documents from a t-rest bag of routes. Request and response schemas are read from the routes' validators and response descriptors through [Standard JSON Schema](https://standardschema.dev), so zod 4.5 or later documents itself. No TypeScript program is involved.

```ts
import { buildOpenAPI } from '@t-rest/open-api-generator'
import { bag } from './bag-of-routes.js'

const build = buildOpenAPI({
  bag,
  info: { title: 'Shop API', description: 'The shop' },
  tags: [{ name: 'products', description: 'The catalog' }],
  specs: [
    // one document per version of the bag's history
    {
      versions: 'all',
      target: '3.0',
      output: 'openapi/internal-{version}.yaml',
    },
    // the newest version, public routes only
    {
      target: '3.1',
      output: 'openapi/public.json',
      filter: (route) => route.meta.public === true,
    },
  ],
})

await build.write()
```

`buildOpenAPI` is pure: it returns the named model of the whole bag, every spec with its `document` and `model`, and every diagnostic. `write()` writes each spec and a `<basename>.api-model.json` sidecar with the model of that spec. Each file is written to a temp file and renamed, so no file is ever half written; the set of files is not written atomically. When a diagnostic is an error, `write()` rejects with `OpenAPIGenerationError` and writes nothing.

Name a schema with `.meta({ id })` or `defineModels` from `@t-rest/core/zod` to make it a component. Document responses with `json(schema, { description, headers, examples, id })`, requests with `.validate(schema, { examples })`, and security with `securityScheme()` and `meta.security`.

## Reference

- [Targets](../../docs/open-api-generator/targets.md): how the OpenAPI versions differ.
- [Diagnostics](../../docs/open-api-generator/diagnostics.md): every code, its severity and its fix.
- [API model](../../docs/open-api-generator/api-model.md): the format of the `.api-model.json` sidecars. Its JSON Schema is exported as `@t-rest/open-api-generator/api-model.schema.json`.
