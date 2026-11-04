import {
  Diagnostic,
  DIAGNOSTICS,
  OpenAPIGenerationError,
} from '../diagnostics/registry.js'
import type { ApiModelDocument } from '../model/document-schema.js'
import { assignNames } from '../naming/assign-names.js'
import { outputFiles, pathCollisions, writeFiles } from '../output/files.js'
import { buildBagModel } from '../route/bag-model.js'
import type { RouteView as BagRouteView } from '../route/config.js'
import { selectSpec } from '../spec/select.js'
import { writeDocument } from '../writer/document.js'
import type {
  AnyBag,
  GeneratedSpec,
  OpenAPIBuild,
  OpenAPIConfig,
  RouteView,
} from './config.js'
import { modelsWithoutId } from './models.js'
import { resolveSpecs } from './specs.js'

const DEFAULT_INFO_VERSION = '1.0.0'

const withSeverities = (
  diagnostics: readonly Diagnostic[],
  overrides: OpenAPIConfig<AnyBag>['diagnostics'] = {}
): Diagnostic[] =>
  diagnostics.map((found) => {
    const severity = (overrides as Record<string, Diagnostic['severity']>)[
      found.code
    ]
    return severity && DIAGNOSTICS[found.code].configurable
      ? { ...found, severity }
      : found
  })

/**
 * Builds every spec of `config` without touching the file system: the bag is
 * read and named once, then each spec is selected from it and written for its
 * target. `write()` puts the specs and their model sidecars on disk.
 */
export const buildOpenAPI = <TBag extends AnyBag>(
  config: OpenAPIConfig<TBag>
): OpenAPIBuild => {
  const view = (route: BagRouteView) =>
    ({
      ...route,
      meta:
        typeof route.meta === 'object' && route.meta !== null ? route.meta : {},
    } as RouteView<TBag>)
  const { operationId } = config

  const bag = buildBagModel(config.bag, {
    headers: config.headers,
    security: config.security,
    securitySchemes: config.securitySchemes,
    securityFromHeaders: config.securityFromHeaders,
    ...(operationId && { operationId: (route) => operationId(view(route)) }),
    vendors: config.vendors,
  })
  const named = assignNames(bag.model, config.naming)
  const resolved = resolveSpecs(config.specs, bag.model.versioning)
  const extraSchemes = (config.securitySchemes ?? []).map(({ name }) => name)

  const specs = resolved.specs.map((spec) => {
    const { filter } = spec
    const selected = selectSpec(named.model, {
      version: spec.version,
      ...(filter && {
        filter: (operation) =>
          filter(view(bag.routes.get(operation.key) as BagRouteView)),
      }),
      schemes: extraSchemes,
    })
    const written = writeDocument(selected.model, spec.target, {
      info: {
        ...config.info,
        version: config.info.version ?? spec.version ?? DEFAULT_INFO_VERSION,
      },
      servers: config.servers,
      tags: config.tags,
    })
    return {
      spec,
      model: selected.model,
      document: written.document,
      diagnostics: [...selected.diagnostics, ...written.diagnostics].map(
        (found) => ({ ...found, at: { ...found.at, spec: spec.output } })
      ),
    }
  })

  const diagnostics = withSeverities(
    [
      ...bag.diagnostics,
      ...named.diagnostics,
      ...(config.naming?.models
        ? modelsWithoutId(config.naming.models, config.vendors?.trust)
        : []),
      ...resolved.diagnostics,
      ...specs.flatMap((spec) => spec.diagnostics),
      ...pathCollisions(specs.map(({ spec }) => spec.output)),
    ],
    config.diagnostics
  )

  return {
    model: named.model as ApiModelDocument,
    specs: specs.map(
      ({ spec, document, model }): GeneratedSpec => ({
        output: spec.output,
        target: spec.target,
        document,
        model: model as ApiModelDocument,
      })
    ),
    diagnostics,
    write: async () => {
      if (diagnostics.some(({ severity }) => severity === 'error'))
        throw new OpenAPIGenerationError(diagnostics)
      await writeFiles(
        outputFiles(
          specs.map(({ spec, document, model }) => ({
            output: spec.output,
            format: spec.format,
            document,
            model,
          }))
        )
      )
    },
  }
}
