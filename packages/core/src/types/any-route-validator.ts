import { z } from 'zod'

export type AnyRouteValidator = z.ZodObject<{
  query?: z.ZodObject<any>
  body?: z.ZodObject<any>
  params?: z.ZodObject<any>
  headers?: z.ZodObject<any>
}>
