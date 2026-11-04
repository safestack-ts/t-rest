import { operationShapes, responseShapes } from '../model/operation.js'
import { refsOf } from '../model/shape.js'
import type { ApiModel, ComponentName } from '../model/types.js'

const pick = <T>(
  record: Readonly<Record<string, T>>,
  keep: ReadonlySet<string>
) => Object.fromEntries(Object.entries(record).filter(([key]) => keep.has(key)))

/** Keeps only the types, shared responses and security schemes the operations reach. */
export const prune = (
  model: ApiModel<ComponentName>
): ApiModel<ComponentName> => {
  const { operations, types, responses, securitySchemes } = model
  const responseIds = new Set(
    operations.flatMap((operation) =>
      Object.values(operation.responses).flatMap((slot) =>
        slot.kind === 'shared' ? [slot.id] : []
      )
    )
  )
  const pending = [
    ...operations.flatMap(operationShapes),
    ...[...responseIds].flatMap((id) => responseShapes(responses[id])),
  ]
    .flatMap(refsOf)
    .map(({ target }) => target)
  const reached = new Set<ComponentName>()
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (reached.has(name)) continue
    reached.add(name)
    pending.push(...refsOf(types[name].shape).map(({ target }) => target))
  }
  const schemes = new Set(
    operations.flatMap((operation) =>
      operation.security.flat().map(({ scheme }) => scheme)
    )
  )

  return {
    ...model,
    types: pick(types, reached),
    responses: pick(responses, responseIds),
    securitySchemes: pick(securitySchemes, schemes),
  }
}
