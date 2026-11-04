import type { Location } from '../diagnostics/registry.js'
import type {
  DefKey,
  Direction,
  MediaType,
  Operation,
  Shape,
  TypeDef,
} from '../model/types.js'

/** Where recursion without an id first sits. */
export type RecursionScope =
  | {
      /** An operation's slot, outside any named type. */
      readonly kind: 'operation'
      readonly operation: Operation<DefKey>
      readonly slot: string
    }
  | {
      /** Inside the named type with this id. */
      readonly kind: 'type'
      readonly id: string
    }

/** What `naming.nameAnonymous` is asked about. */
export type AnonymousContext =
  | {
      /** An inline object at the root of a request or response body. */
      readonly kind: 'slot'
      readonly operation: Operation<DefKey>
      readonly slot: 'body' | `response ${string}`
      readonly contentType: string
      readonly shape: Shape<DefKey>
    }
  | {
      /** Recursion without an author id; it needs a name to be referenced. */
      readonly kind: 'recursive'
      readonly scope: RecursionScope
      /** JSON pointer from the slot or the named type. */
      readonly pointer: string
      readonly shape: Shape<DefKey>
    }

export type NameAnonymous = (context: AnonymousContext) => string | undefined

export interface SlotRoots {
  readonly operations: readonly Operation<DefKey>[]
  /** The types the hook named, with the name it gave each. */
  readonly types: Readonly<Record<DefKey, TypeDef<DefKey>>>
  readonly names: ReadonlyMap<DefKey, string>
}

/**
 * Replaces each inline object body the hook names by a ref to a new type of
 * its own; `assignNames` shares one component between equal types of one name.
 */
export const nameSlotRoots = (
  operations: readonly Operation<DefKey>[],
  nameAnonymous: NameAnonymous | undefined
): SlotRoots => {
  const types: Record<DefKey, TypeDef<DefKey>> = {}
  const names = new Map<DefKey, string>()
  if (!nameAnonymous) return { operations, types, names }

  const named = (
    operation: Operation<DefKey>,
    slot: 'body' | `response ${string}`,
    direction: Direction,
    content: Readonly<Record<string, MediaType<DefKey>>>
  ): Record<string, MediaType<DefKey>> =>
    Object.fromEntries(
      Object.entries(content).map(([contentType, media]) => {
        const { shape } = media
        const name =
          shape.kind === 'object'
            ? nameAnonymous({
                kind: 'slot',
                operation,
                slot,
                contentType,
                shape,
              })
            : undefined
        if (name === undefined) return [contentType, media]

        const key = `anon:${operation.key}#${slot} ${contentType}#` as DefKey
        types[key] = { kind: 'anonymous', direction, shape }
        names.set(key, name)
        return [contentType, { ...media, shape: { kind: 'ref', target: key } }]
      })
    )

  return {
    operations: operations.map((operation) => ({
      ...operation,
      ...(operation.requestBody && {
        requestBody: {
          ...operation.requestBody,
          content: named(
            operation,
            'body',
            'input',
            operation.requestBody.content
          ),
        },
      }),
      responses: Object.fromEntries(
        Object.entries(operation.responses).map(([status, slot]) => [
          status,
          slot.kind === 'shared'
            ? slot
            : {
                kind: 'inline',
                response: {
                  ...slot.response,
                  content: named(
                    operation,
                    `response ${status}`,
                    'output',
                    slot.response.content
                  ),
                },
              },
        ])
      ),
    })),
    types,
    names,
  }
}

/**
 * `anon:<direction>:<id>#<pointer>` inside a named type, else
 * `anon:<operation key>#<slot>#<pointer>`; ids, operation keys and slots hold no `#`.
 */
const parseAnonymousKey = (key: DefKey) => {
  const [scope, ...rest] = key.slice('anon:'.length).split('#')
  const type = /^(?:input|output):(.*)$/.exec(scope)
  if (type)
    return { kind: 'type', id: type[1], pointer: rest.join('#') } as const
  const [slot, ...pointer] = rest
  return {
    kind: 'operation',
    operation: scope,
    slot,
    pointer: pointer.join('#'),
  } as const
}

export interface RecursionName {
  /** The hook's name, if it gave one. */
  readonly named: string | undefined
  /** `<operationId>_<slot><pointer>` or `<id><pointer>`, without `$defs/<def>` steps. */
  readonly fallback: string
  readonly at: Location
}

export const recursionName = (
  key: DefKey,
  shape: Shape<DefKey>,
  operations: readonly Operation<DefKey>[],
  nameAnonymous: NameAnonymous | undefined
): RecursionName => {
  const parsed = parseAnonymousKey(key)
  const pointer = parsed.pointer.replace(/\/\$defs\/[^/]+/g, '')
  if (parsed.kind === 'type')
    return {
      named: nameAnonymous?.({
        kind: 'recursive',
        scope: { kind: 'type', id: parsed.id },
        pointer: parsed.pointer,
        shape,
      }),
      fallback: `${parsed.id}${pointer}`,
      at: { pointer: parsed.pointer },
    }

  const { operation: at, slot } = parsed
  const operation = operations.find(({ key }) => key === at)
  return {
    named:
      operation &&
      nameAnonymous?.({
        kind: 'recursive',
        scope: { kind: 'operation', operation, slot },
        pointer: parsed.pointer,
        shape,
      }),
    fallback: `${operation?.operationId ?? at}_${slot}${pointer}`,
    at: { operation: at, slot, pointer: parsed.pointer },
  }
}
