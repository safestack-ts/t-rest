import { z } from 'zod'

// recursive zod schema typed with zod's recursive `JSONType`
export const jsonValueSchema: z.ZodType<z.core.util.JSONType> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
)

export const nestedFilterSchema = z.partialRecord(
  z.enum(['gt', 'lt', 'equals']),
  jsonValueSchema
)

// output type inferred from the recursive schema, without a hand-written interface
export const autoDiscountFilterSchema = z.strictObject({
  type: z.enum(['condition', 'custom']),
  key: z.string().min(1),
  condition: nestedFilterSchema,
})

export type AutoDiscountFilter = z.infer<typeof autoDiscountFilterSchema>
