import { Diagnostic, diagnostic } from '../diagnostics/registry.js'
import { mapOperationShapes, mapResponseShapes } from '../model/operation.js'
import { mapRefs, withDocs } from '../model/shape.js'
import type {
  ApiModel,
  ComponentName,
  DefKey,
  Shape,
  TypeDef,
} from '../model/types.js'
import {
  NameAnonymous,
  nameSlotRoots,
  RecursionName,
  recursionName,
} from './anonymous.js'
import { typeBlocks } from './direction.js'
import { probableModels } from './probable-model.js'

export interface NamingOptions {
  /** `reference`: an alias is a component that only refers to its target. `materialize`: a copy of the target's body. */
  readonly aliases?: 'reference' | 'materialize'
  /** Appended to the id of an input type that differs from its output. */
  readonly inputSuffix?: string
  readonly nameAnonymous?: NameAnonymous
}

export interface NamedModel {
  readonly model: ApiModel<ComponentName>
  readonly diagnostics: readonly Diagnostic[]
}

const DEFAULT_INPUT_SUFFIX = 'Input'

const sanitize = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '_')

interface Wanted<K extends string> {
  readonly owner: K
  readonly name: string
  /** A fallback the generator made up; two fallbacks may clash without an error. */
  readonly fallback?: boolean
}

/** Gives each wanted name to its first owner; a later owner gets `_2`, `_3`, ... and `naming/component-conflict` unless both are fallbacks. */
const allocate = <K extends string>(
  wanted: readonly Wanted<K>[]
): { names: Map<K, string>; diagnostics: Diagnostic[] } => {
  const owners = new Map<string, Wanted<K>>()
  const names = new Map<K, string>()
  const diagnostics: Diagnostic[] = []
  for (const entry of wanted) {
    const base = sanitize(entry.name)
    let name = base
    const taken = owners.get(base)
    if (taken !== undefined) {
      if (!(taken.fallback && entry.fallback))
        diagnostics.push(
          diagnostic(
            'naming/component-conflict',
            {},
            { name: base, owners: [taken.owner, entry.owner] }
          )
        )
      for (let n = 2; owners.has(name); n++) name = `${base}_${n}`
    }
    owners.set(name, entry)
    names.set(entry.owner, name)
  }
  return { names, diagnostics }
}

/**
 * Names every type and shared response of the whole-bag model once, so specs
 * selected from it share names. Pure.
 */
export const assignNames = (
  model: ApiModel<DefKey>,
  options: NamingOptions = {}
): NamedModel => {
  const diagnostics: Diagnostic[] = []
  const slots = nameSlotRoots(model.operations, options.nameAnonymous)
  const types: Readonly<Record<DefKey, TypeDef<DefKey>>> = {
    ...model.types,
    ...slots.types,
  }
  const blocks = typeBlocks(types, slots.names)
  const inputSuffix = options.inputSuffix ?? DEFAULT_INPUT_SUFFIX
  const keys = (Object.keys(types) as DefKey[]).sort()

  // Equal slot roots share one component per hook name; equal recursion one
  // per hook name, or one fallback per block.
  const sharedAnonymous = new Map<DefKey, DefKey>()
  const groups = new Map<string, DefKey>()
  /** Whether `key` owns the component of its group. */
  const share = (key: DefKey, name: string) => {
    const group = `${blocks.blockOf(key)}|${name}`
    const owner = groups.get(group) ?? key
    groups.set(group, owner)
    sharedAnonymous.set(key, owner)
    return owner === key
  }
  const recursion = new Map<DefKey, RecursionName>()
  for (const key of keys) {
    const type = types[key]
    if (type.kind !== 'anonymous') continue
    const slotName = slots.names.get(key)
    if (slotName !== undefined) {
      share(key, `slot:${slotName}`)
      continue
    }
    const naming = recursionName(
      key,
      type.shape,
      model.operations,
      options.nameAnonymous
    )
    if (share(key, naming.named === undefined ? '' : `name:${naming.named}`))
      recursion.set(key, naming)
  }

  const componentKey = (key: DefKey): DefKey => {
    const type = types[key]
    if (type.kind === 'anonymous') return sharedAnonymous.get(key) ?? key
    return type.direction === 'input' && blocks.merged.has(type.id)
      ? (`output:${type.id}` as DefKey)
      : key
  }

  // author ids claim their names before sanitized ids, and those before derived names
  const authored: Wanted<DefKey>[] = []
  const derived: Wanted<DefKey>[] = []
  for (const key of keys) {
    if (componentKey(key) !== key) continue
    const type = types[key]
    const slotName = slots.names.get(key)
    const naming = recursion.get(key)
    if (slotName !== undefined) derived.push({ owner: key, name: slotName })
    else if (naming !== undefined)
      derived.push(
        naming.named === undefined
          ? { owner: key, name: naming.fallback, fallback: true }
          : { owner: key, name: naming.named }
      )
    else if (type.kind === 'anonymous') continue
    else if (
      type.direction === 'input' &&
      types[`output:${type.id}` as DefKey] !== undefined
    ) {
      const input = `${type.id}${inputSuffix}`
      diagnostics.push(
        diagnostic('naming/direction-split', {}, { id: type.id, input })
      )
      derived.push({ owner: key, name: input })
    } else authored.push({ owner: key, name: type.id })
  }

  const exact = ({ name }: Wanted<DefKey>) => sanitize(name) === name
  const typeNames = allocate([
    ...authored.filter(exact),
    ...authored.filter((entry) => !exact(entry)),
    ...derived,
  ])
  const responseNames = allocate(
    Object.keys(model.responses)
      .sort()
      .map((id) => ({ owner: id, name: id }))
  )
  for (const [key, naming] of recursion)
    if (naming.named === undefined)
      diagnostics.push(
        diagnostic('naming/anonymous-recursion', naming.at, {
          name: typeNames.names.get(key) as string,
        })
      )
  diagnostics.push(...typeNames.diagnostics, ...responseNames.diagnostics)

  const nameOf = (key: DefKey) =>
    typeNames.names.get(componentKey(key)) as ComponentName
  const rename = (shape: Shape<DefKey>): Shape<ComponentName> =>
    mapRefs(shape, (ref) => ({ ...ref, target: nameOf(ref.target) }))
  // shallow: the copy keeps the refs of the target's body
  const materialize = (shape: Shape<DefKey>): Shape<DefKey> => {
    const target = shape.kind === 'ref' ? types[shape.target] : undefined
    return target?.kind === 'named'
      ? withDocs(materialize(target.shape), shape.docs)
      : shape
  }
  const bodyOf = (type: TypeDef<DefKey>) =>
    type.kind === 'named' && options.aliases === 'materialize'
      ? materialize(type.shape)
      : type.shape

  const namedTypes = Object.fromEntries(
    [...typeNames.names]
      .sort(([, a], [, b]) => (a < b ? -1 : 1))
      .map(([key, name]) => {
        const type = types[key]
        return [name, { ...type, shape: rename(bodyOf(type)) }]
      })
  ) as Record<ComponentName, TypeDef<ComponentName>>

  const responseId = (id: string) => responseNames.names.get(id) as string
  const operations = slots.operations.map((operation) => {
    const renamed = mapOperationShapes(operation, rename)
    return {
      ...renamed,
      responses: Object.fromEntries(
        Object.entries(renamed.responses).map(([status, slot]) => [
          status,
          slot.kind === 'shared' ? { ...slot, id: responseId(slot.id) } : slot,
        ])
      ),
    }
  })

  return {
    model: {
      ...model,
      types: namedTypes,
      responses: Object.fromEntries(
        Object.entries(model.responses).map(([id, response]) => [
          responseId(id),
          mapResponseShapes(response, rename),
        ])
      ),
      operations,
    },
    diagnostics: [...diagnostics, ...probableModels(operations)],
  }
}
