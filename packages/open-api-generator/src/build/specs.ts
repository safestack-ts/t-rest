import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import type { Versioning } from '../model/types.js'
import { Format, formatOf } from '../output/serialize.js'
import type { AnyBag, SpecConfig } from './config.js'

const PLACEHOLDER = '{version}'

export interface ResolvedSpec<TBag extends AnyBag> {
  readonly output: string
  readonly format: Format
  readonly target: SpecConfig<TBag>['target']
  /** `undefined` in an unversioned bag. */
  readonly version: string | undefined
  readonly filter: SpecConfig<TBag>['filter']
}

/** Why the output of `spec` cannot be written, if it cannot. */
const templateProblems = (
  spec: SpecConfig<AnyBag>,
  versioning: Versioning
): string[] => {
  const templated = spec.output.includes(PLACEHOLDER)
  return [
    ...(spec.versions !== undefined && versioning.kind === 'none'
      ? ['lists versions, but the bag is not versioned']
      : spec.versions !== undefined && !templated
      ? [`has no ${PLACEHOLDER}, but the spec has several versions`]
      : []),
    ...(versioning.kind === 'none' && templated
      ? [`has ${PLACEHOLDER}, but the bag is not versioned`]
      : []),
    ...(formatOf(spec.output) === undefined
      ? ['does not end in .yaml, .yml or .json']
      : []),
  ]
}

/** Why the versions of `spec` do not fit the bag's history, if they do not. */
const versionProblems = (
  spec: SpecConfig<AnyBag>,
  versioning: Versioning
): string[] => {
  if (spec.versions === 'all') return []
  if (spec.versions !== undefined) {
    // versions of an unversioned bag are config/output-template
    if (versioning.kind === 'none') return []
    if (spec.versions.length === 0) return ['lists no versions']
  }
  const history: readonly string[] =
    versioning.kind === 'none' ? [] : versioning.history
  return (spec.versions ?? (spec.version === undefined ? [] : [spec.version]))
    .filter((version) => !history.includes(version))
    .map((version) => `names ${version}, which is not in the version history`)
}

/** One spec per version of every spec config, with its output resolved. */
export const resolveSpecs = <TBag extends AnyBag>(
  specs: readonly SpecConfig<TBag>[],
  versioning: Versioning
): { specs: ResolvedSpec<TBag>[]; diagnostics: Diagnostic[] } => {
  const history = versioning.kind === 'none' ? [] : versioning.history
  const versionsOf = (spec: SpecConfig<TBag>): (string | undefined)[] =>
    versioning.kind === 'none'
      ? [undefined]
      : spec.versions === undefined
      ? [spec.version ?? history[history.length - 1]]
      : spec.versions === 'all'
      ? [...history]
      : [...spec.versions]

  return {
    specs: specs.flatMap((spec) =>
      versionsOf(spec).map((version) => {
        const output = spec.output.split(PLACEHOLDER).join(version ?? '')
        return {
          output,
          // a spec with a problem is never written, any format will do
          format: formatOf(output) ?? 'yaml',
          target: spec.target,
          version,
          filter: spec.filter,
        }
      })
    ),
    diagnostics: specs.flatMap((spec) => [
      ...templateProblems(spec, versioning).map((reason) =>
        diagnostic(
          'config/output-template',
          { spec: spec.output },
          { output: spec.output, reason }
        )
      ),
      ...versionProblems(spec, versioning).map((reason) =>
        diagnostic(
          'config/spec-version',
          { spec: spec.output },
          { output: spec.output, reason }
        )
      ),
    ]),
  }
}
