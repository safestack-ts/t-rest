import { z } from 'zod'

export type AnyRouteValidator = z.ZodObject<{
  params?: z.ZodObject<any>
  query?: z.ZodObject<any> | z.ZodOptional<z.ZodObject<any>>
  body?: z.AnyZodObject
  headers?: z.ZodObject<any> | z.ZodOptional<z.ZodObject<any>>
}>
