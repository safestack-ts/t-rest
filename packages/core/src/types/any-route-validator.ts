import { z } from 'zod'

type AnyZodShape<T extends z.ZodRawShape> =
  | z.ZodObject<T>
  | z.ZodEffects<z.ZodObject<T>>

export type AnyRouteValidator = AnyZodShape<{
  params?: z.ZodTypeAny
  query?: z.ZodTypeAny
  body?: z.ZodTypeAny
  headers?: z.ZodTypeAny
}>
