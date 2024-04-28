import { z } from 'zod'

export const emptyValidation = z.object({})

export type EmptyValidation = z.infer<typeof emptyValidation>
