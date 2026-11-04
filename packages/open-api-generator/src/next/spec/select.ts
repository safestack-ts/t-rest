import { resolveDateVersion, resolveVersion } from '@t-rest/core'
import { pathParamNames, pathShape } from '@t-rest/protocol'
import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import type {
  ApiModel,
  ComponentName,
  HTTPMethod,
  Operation,
  Versioning,
} from '../model/types.js'
import { operationKey } from '../route/bag-model.js'
import { prune } from './prune.js'

export interface SpecSelection {
  /** The spec version. A versioned model without one selects its newest version; unversioned models ignore it. */
  readonly version?: string
  /** Runs on every revision before version resolution; `false` drops the revision. */
  readonly filter?: (operation: Operation<ComponentName>) => boolean
}

export interface SelectedSpec {
  readonly model: ApiModel<ComponentName>
  readonly diagnostics: readonly Diagnostic[]
}

const METHOD_ORDER: Record<HTTPMethod, number> = {
  GET: 0,
  POST: 1,
  PUT: 2,
  PATCH: 3,
  DELETE: 4,
}

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string) => {
  const groups = new Map<string, T[]>()
  for (const item of items)
    groups.set(keyOf(item), [...(groups.get(keyOf(item)) ?? []), item])
  return [...groups.values()]
}

// the version history is never mutated by core's resolvers
const resolve = (
  versioning: Versioning,
  versions: string[],
  version: string | undefined
): string | null => {
  if (versioning.kind === 'none') return versions[0]
  const history = versioning.history as string[]
  const requested = version ?? history[history.length - 1]
  return versioning.kind === 'date'
    ? resolveDateVersion(history, versions, requested, (v) => new Date(v))
    : resolveVersion(history, versions, requested)
}

/** The revision of each route the spec version resolves to; routes without one are dropped. */
const resolveRevisions = (
  revisions: readonly Operation<ComponentName>[],
  versioning: Versioning,
  version: string | undefined
) =>
  groupBy(revisions, ({ method, path }) =>
    operationKey(method, path, '')
  ).flatMap((route) => {
    const resolved = resolve(
      versioning,
      route.map(({ version }) => version),
      version
    )
    return route.filter(({ version }) => version === resolved).slice(0, 1)
  })

/**
 * Routes whose paths differ only in param names share one path: the first in
 * method order names the params, the others are renamed by position.
 */
const normalizePaths = (operations: readonly Operation<ComponentName>[]) =>
  groupBy(operations, ({ path }) => pathShape(path)).flatMap((samePath) => {
    const sorted = [...samePath].sort(
      (a, b) => METHOD_ORDER[a.method] - METHOD_ORDER[b.method]
    )
    const template = sorted[0].path
    const templateNames = pathParamNames(template)
    return sorted.map((operation) => {
      const names = pathParamNames(operation.path)
      return {
        ...operation,
        path: template,
        parameters: operation.parameters.map((parameter) =>
          parameter.in === 'path' && names.includes(parameter.name)
            ? {
                ...parameter,
                name:
                  templateNames[names.indexOf(parameter.name)] ??
                  parameter.name,
              }
            : parameter
        ),
      }
    })
  })

const duplicateOperationIds = (
  operations: readonly Operation<ComponentName>[]
): Diagnostic[] =>
  groupBy(operations, ({ operationId }) => operationId)
    .filter((group) => group.length > 1)
    .map((group) =>
      diagnostic(
        'operation/duplicate-operation-id',
        { operation: group[1].key },
        {
          operationId: group[0].operationId,
          operations: group.map(({ key }) => key),
        }
      )
    )

/**
 * One spec of the named whole-bag model: filter every revision, resolve the
 * spec version per route, normalize paths, then prune to what the kept
 * operations reach. Pure.
 */
export const selectSpec = (
  model: ApiModel<ComponentName>,
  { version, filter = () => true }: SpecSelection
): SelectedSpec => {
  const operations = normalizePaths(
    resolveRevisions(model.operations.filter(filter), model.versioning, version)
  ).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  return {
    model: prune({ ...model, operations }),
    diagnostics: duplicateOperationIds(operations),
  }
}
