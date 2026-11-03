import type { Direction } from '../model/types.js'
import type { JsonSchemaObject } from './convert.js'
import {
  derefPointer,
  isSchemaObject,
  JsonSchema,
  pointerTo,
  resolvePointer,
  subschemaPaths,
  transformSchema,
} from './json-schema.js'
import type { VendorPolicy } from './vendor-policy.js'

export interface NormalizeOptions {
  readonly direction: Direction
  readonly policy: VendorPolicy
  /** The input conversion of the same schema; `undefined` when it threw. */
  readonly input: JsonSchema | undefined
}

interface RuleContext {
  readonly direction: Direction
  readonly policy: VendorPolicy
  /** Output pointers of the objects that the input conversion closes. */
  readonly strictOnInput: ReadonlySet<string>
}

interface NormalizationRule {
  readonly name: string
  readonly applies: (context: RuleContext) => boolean
  readonly rewrite: (
    node: JsonSchemaObject,
    pointer: string,
    context: RuleContext
  ) => JsonSchemaObject
}

export const without = (node: JsonSchemaObject, ...keys: string[]) =>
  Object.fromEntries(
    Object.entries(node).filter(([key]) => !keys.includes(key))
  )

/** Rules matched on JSON Schema shapes, applied to every subschema in order. */
export const NORMALIZATION_RULES: readonly NormalizationRule[] = [
  {
    // zod emits these bounds for every `z.int()`; they restate the safe-integer range
    name: 'safe-integer-bounds',
    applies: ({ policy }) => policy.safeIntegers,
    rewrite: (node) =>
      node.type !== 'integer'
        ? node
        : without(
            node,
            ...(node.minimum === Number.MIN_SAFE_INTEGER ? ['minimum'] : []),
            ...(node.maximum === Number.MAX_SAFE_INTEGER ? ['maximum'] : [])
          ),
  },
  {
    // zod closes every output object; only objects closed on input are strict
    name: 'open-output-objects',
    applies: ({ direction }) => direction === 'output',
    rewrite: (node, pointer, { strictOnInput }) =>
      node.additionalProperties !== false || strictOnInput.has(pointer)
        ? node
        : without(node, 'additionalProperties'),
  },
  {
    // `.readonly()` is TS immutability; OpenAPI `readOnly` would tell clients to omit the field
    name: 'readonly-input',
    applies: ({ direction }) => direction === 'input',
    rewrite: (node) =>
      node.readOnly === true ? without(node, 'readOnly') : node,
  },
]

/**
 * Walks the output and input conversions from their roots in step, following
 * `$ref` on each side, so generated def names may differ between directions.
 * An output object is strict only if every input object it meets is closed.
 */
const objectsStrictOnInput = (
  output: JsonSchema,
  input: JsonSchema
): Set<string> => {
  const strict = new Map<string, boolean>()
  const walked = new Set<string>()
  const walk = (outputFrom: string, inputFrom: string | undefined) => {
    const outputAt = derefPointer(output, outputFrom)
    const inputAt =
      inputFrom === undefined ? undefined : derefPointer(input, inputFrom)
    const pair = JSON.stringify([outputAt, inputAt])
    if (walked.has(pair)) return
    walked.add(pair)

    const outputNode = resolvePointer(output, outputAt)
    const inputNode =
      inputAt === undefined ? undefined : resolvePointer(input, inputAt)
    if (!isSchemaObject(outputNode)) return
    const closed =
      isSchemaObject(inputNode) && inputNode.additionalProperties === false
    strict.set(outputAt, (strict.get(outputAt) ?? true) && closed)

    // Defs are reached through `$ref`; their names differ between directions.
    for (const path of subschemaPaths(outputNode))
      if (path[0] !== '$defs')
        walk(
          pointerTo(outputAt, ...path),
          isSchemaObject(inputNode)
            ? pointerTo(inputAt as string, ...path)
            : undefined
        )
  }
  walk('', '')
  return new Set(
    [...strict].filter(([, closed]) => closed).map(([pointer]) => pointer)
  )
}

export const normalize = (
  schema: JsonSchemaObject,
  { direction, policy, input }: NormalizeOptions
): JsonSchema => {
  const context: RuleContext = {
    direction,
    policy,
    strictOnInput:
      direction === 'output' && input !== undefined
        ? objectsStrictOnInput(schema, input)
        : new Set(),
  }
  const rules = NORMALIZATION_RULES.filter((rule) => rule.applies(context))
  return transformSchema(schema, (node, pointer) =>
    rules.reduce(
      (current, rule) => rule.rewrite(current, pointer, context),
      node
    )
  )
}
