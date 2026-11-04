import type { RouteMeta, SecurityRequirements } from '@t-rest/core'
import { z } from 'zod'
import { Diagnostic, diagnostic, Location } from '../diagnostics/registry.js'
import { nonJsonType } from '../model/json.js'
import type { HTTPMethod, Operation } from '../model/types.js'
import { isSchemeRef, SchemeRef } from './security.js'

const link = z.object({ url: z.string(), description: z.string().optional() })

// `.metaData()` is typed, but a `@ts-expect-error` or an untyped caller can pass anything.
const ROUTE_META = {
  summary: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  deprecated: z.boolean(),
  operationId: z.string(),
  externalDocs: link,
  servers: z.array(
    link.extend({
      variables: z
        .record(
          z.string(),
          z.object({
            default: z.string(),
            description: z.string().optional(),
            enum: z.array(z.string()).optional(),
          })
        )
        .optional(),
    })
  ),
  security: z.array(z.array(z.custom<SchemeRef>(isSchemeRef))),
} satisfies Record<keyof RouteMeta, z.ZodType>

type MetaKey = keyof typeof ROUTE_META

const isMetaKey = (key: string): key is MetaKey =>
  Object.prototype.hasOwnProperty.call(ROUTE_META, key)

export type OperationDocs = Pick<
  Operation<never>,
  'summary' | 'description' | 'tags' | 'deprecated' | 'externalDocs' | 'servers'
>

export interface MetaRead {
  readonly docs: OperationDocs
  readonly operationId?: string
  readonly security?: SecurityRequirements
  readonly extensions: Readonly<Record<string, unknown>>
  readonly diagnostics: readonly Diagnostic[]
}

/** Splits route meta into operation fields and JSON extensions. */
export const readMeta = (meta: unknown, at: Location): MetaRead => {
  const known: Partial<RouteMeta> = {}
  const extensions: Record<string, unknown> = {}
  const diagnostics: Diagnostic[] = []

  const entries =
    typeof meta === 'object' && meta !== null ? Object.entries(meta) : []
  for (const [key, value] of entries) {
    if (value === undefined) continue
    if (isMetaKey(key)) {
      const parsed = ROUTE_META[key].safeParse(value)
      if (parsed.success) Object.assign(known, { [key]: parsed.data })
      else diagnostics.push(diagnostic('operation/invalid-meta', at, { key }))
      continue
    }
    const type = nonJsonType(value)
    if (type === undefined) extensions[key] = value
    else
      diagnostics.push(
        diagnostic('operation/meta-not-serializable', at, { key, type })
      )
  }

  const {
    operationId,
    security,
    tags = [],
    deprecated = false,
    ...rest
  } = known
  return {
    docs: { ...rest, tags, deprecated },
    ...(operationId !== undefined && { operationId }),
    ...(security !== undefined && { security }),
    extensions,
    diagnostics,
  }
}

const pascalCase = (text: string) =>
  text
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('')

/** `GET /users/:userId/files` -> `getUsersByUserIdFiles`. */
export const defaultOperationId = (
  method: HTTPMethod,
  path: string
): string => {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      segment.startsWith(':')
        ? `By${pascalCase(segment.slice(1))}`
        : pascalCase(segment)
    )
  return `${method.toLowerCase()}${segments.join('') || 'Root'}`
}
