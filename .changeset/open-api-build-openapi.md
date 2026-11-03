---
'@t-rest/open-api-generator': major
---

`buildOpenAPI(config)` replaces `OpenAPIGenerator`. The generator reads request and response schemas through Standard JSON Schema instead of a TypeScript program, keeps them in a format-neutral API model, names every component once per bag, and writes OpenAPI 3.0, 3.1 or 3.2 from one writer. `buildOpenAPI` is pure and returns the model, every spec with its document, and the diagnostics; `write()` writes each spec with a `<basename>.api-model.json` sidecar and rejects with `OpenAPIGenerationError` without writing anything when a diagnostic is an error. The sidecar format is documented in `docs/open-api-generator/api-model.md`, its JSON Schema is exported as `@t-rest/open-api-generator/api-model.schema.json`, and `parseApiModel` reads it. The package exports nothing else: `OpenAPIGenerator`, `OpenAPISpec`, the type IR (`StringType` and the other type constructors), `validateRouteMeta`, `Header`, `OpenAPIMetaData` and `OpenAPIGeneratorOptions` are removed.

The `typescript` peer dependency is removed, `zod` becomes a peer dependency `^4.5.0`. zod 4.5 is the first release whose JSON Schema turns a root `.meta({ id })` into a reference to its definition, so `json(Product)` documents `Product` as a component; older releases inline it.

Migration:

- **`OpenAPIGenerator.generate`** becomes one `buildOpenAPI` call with a spec per document. `outputDir` and `outputFile` become `output`, whose extension (`.yaml`, `.yml`, `.json`) picks the format. `entry` and `tsConfigPath` are gone. `OpenAPISpec.ofVersion(bag, version)` becomes `version` of a spec, `versions: 'all'` writes one spec per version into `output` with `{version}`, and `withMetaData(meta)` becomes `info`, `servers` and `tags`: `title`, `description`, `version` and `contact` go into `info`. The filter receives `meta` instead of `metaData`, typed from the bag's routes; `meta` is `{}` for a route without `.metaData()`, and `version` is `''` in an unversioned bag. `target` is required, `'3.0'` keeps the previous format.

  ```ts
  // before
  await OpenAPIGenerator.generate([
    {
      spec: OpenAPISpec.ofVersion(bag, '2024-01-01').withMetaData({
        title: 'Shop',
        description: 'The shop',
        headers: [{ name: 'x-client-id', required: true, type: StringType() }],
      }),
      outputDir: 'docs',
      outputFile: 'openapi.yaml',
      entry: './src/bag.ts',
      tsConfigPath: './tsconfig.json',
      filter: ({ metaData }) => metaData?.public === true,
    },
  ])
  // after
  await buildOpenAPI({
    bag,
    info: { title: 'Shop', description: 'The shop' },
    headers: z.object({ 'x-client-id': z.string() }),
    specs: [
      {
        version: '2024-01-01',
        target: '3.0',
        output: 'docs/openapi.yaml',
        filter: (route) => route.meta.public === true,
      },
    ],
  }).write()
  ```

- **`OpenAPISpec.of(bag)`** for an unversioned bag becomes a spec without `version`. `info.version` is optional: it defaults to the spec version, and to `1.0.0` in an unversioned bag.

  ```ts
  // before
  await OpenAPIGenerator.generate([
    {
      spec: OpenAPISpec.of(bag).withMetaData({
        title: 'Shop',
        description: 'The shop',
        version: '2.1.0',
        contact: { email: 'api@example.com' },
      }),
      outputDir: 'docs',
      outputFile: 'openapi.yaml',
      entry: './src/bag.ts',
      tsConfigPath: './tsconfig.json',
    },
  ])
  // after
  await buildOpenAPI({
    bag,
    info: {
      title: 'Shop',
      description: 'The shop',
      version: '2.1.0',
      contact: { email: 'api@example.com' },
    },
    specs: [{ target: '3.0', output: 'docs/openapi.yaml' }],
  }).write()
  ```

- **Removed options.** `includeTypesNamespaceInName`, `canonicalTypeOwnership` and `deriveRouteNamingContext` named components after TypeScript types and namespaces. Components are now named by schema ids: `.meta({ id: 'Product' })`, or `defineModels('V2024_01_01.Shared', { Product })` from `@t-rest/core/zod` for namespaced names such as `V2024_01_01_Shared_Product`. `naming.models` takes a models module and fails the run for each schema in it without an id (`naming/model-without-id`). `naming.nameAnonymous` names inline body objects, `naming.inputSuffix` (default `Input`) names the input of a schema that reads differently as request and as response, and `naming.aliases` decides whether a schema with a second id refers to the first or copies it.

- **`json<T>()` becomes `json(schema)`.** A response typed only by TypeScript is documented as any JSON value with the `response/untyped-json` warning:

  ```ts
  // before
  Route.get('/products').responses({ 200: json<Product[]>() })
  // after
  Route.get('/products').responses({ 200: json(z.array(Product)) })
  ```

- **Header meta becomes validator headers.** Headers documented in route meta are read from the validator's `headers` key, global headers from `config.headers`, one object schema. Route headers win over global headers of the same name.

  ```ts
  // before
  Route.get('/me').metaData({
    headers: [{ name: 'x-trace', type: StringType() }],
  })
  // after
  Route.get('/me').validate(
    z.object({ headers: z.object({ 'x-trace': z.string().optional() }) })
  )
  ```

- **Security.** Declare schemes with `securityScheme()` of `@t-rest/core` and reference them in `meta.security`; `config.security` is the default of routes without it, and `config.securitySchemes` documents schemes no route uses. `securityFromHeaders` bridges routes that still declare an `authorization` header: the header is documented as the scheme and removed from the parameters.

  ```ts
  const bearer = securityScheme('bearer', { type: 'http', scheme: 'bearer' })
  buildOpenAPI({
    bag,
    info,
    securityFromHeaders: { authorization: bearer },
    specs,
  })
  ```

- **Examples.** Response examples live on the descriptor, `json(Product, { examples: { chair: { value: { id: 1, name: 'Chair' } } } })`, request examples on the validator, `.validate(schema, { examples })`. Both are checked against their schema.

- **One-time renames in the output.** Component names follow schema ids instead of TypeScript type names. A schema used as request and as response that reads differently in the two directions, e.g. because of a `.default()`, becomes two components, `X` and `XInput`. 3.0 documents declare `openapi: 3.0.3` instead of `3.0.0`, response descriptions fall back to the reason phrase (`OK`, `Not Found`) instead of `Successful response` and `Error response`, empty `servers`, `tags` and `parameters` are left out, unions of components with a common literal property get a `discriminator`, and enum values keep the order of the schema.
