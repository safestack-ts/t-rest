import { Diagnostic, diagnostic, Location } from '../diagnostics/registry.js'
import { stableStringify } from '../model/json.js'
import type { DefKey, Shape, TypeDef } from '../model/types.js'
import type { StandardJSONSchemaSource } from '../reader/convert.js'
import {
  createReaderRun,
  ReaderRun,
  readSchema,
  SchemaSlot,
} from '../reader/read-schema.js'

/** What one `buildBagModel` call accumulates. Created per call, never shared. */
export interface RouteRun {
  readonly reader: ReaderRun
  /** Every type read so far, by key. */
  readonly types: Readonly<Record<DefKey, TypeDef<DefKey>>>
  readonly diagnostics: readonly Diagnostic[]
  readonly report: (...found: readonly Diagnostic[]) => void
  /** Adds the types of one read; a named key read with another shape is `naming/duplicate-id`. */
  readonly addTypes: (
    found: Readonly<Record<DefKey, TypeDef<DefKey>>>,
    at: Location
  ) => void
  readonly read: (
    schema: StandardJSONSchemaSource,
    slot: SchemaSlot
  ) => Shape<DefKey>
}

export const createRouteRun = (
  trustedVendors?: readonly string[]
): RouteRun => {
  const reader = createReaderRun({ trustedVendors })
  const types: Record<DefKey, TypeDef<DefKey>> = {}
  const diagnostics: Diagnostic[] = []

  const report = (...found: readonly Diagnostic[]) => {
    diagnostics.push(...found)
  }
  const addTypes: RouteRun['addTypes'] = (found, at) => {
    for (const [key, type] of Object.entries(found) as [
      DefKey,
      TypeDef<DefKey>
    ][]) {
      const known = types[key]
      if (known === undefined) types[key] = type
      else if (
        type.kind === 'named' &&
        stableStringify(known) !== stableStringify(type)
      )
        report(diagnostic('naming/duplicate-id', at, { id: type.id }))
    }
  }

  return {
    reader,
    types,
    diagnostics,
    report,
    addTypes,
    read: (schema, slot) => {
      const read = readSchema(schema, slot, reader)
      addTypes(read.types, { operation: slot.operation, slot: slot.slot })
      report(...read.diagnostics)
      return read.shape
    },
  }
}
