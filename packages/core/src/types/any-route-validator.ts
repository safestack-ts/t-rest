import type { StandardSchemaV1 } from '@standard-schema/spec'

export type AnyRouteValidator = StandardSchemaV1<{
  params?: Record<string, unknown>
  query?: Record<string, unknown>
  body?: any
  headers?: Record<string, unknown>
  [key: string]: any
}>
