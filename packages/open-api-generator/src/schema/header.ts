import { TypedIdentity } from '@t-rest/core'
import { z } from 'zod'
import { validateTypeDefinition } from './type-schema'

export const validateHeader = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  type: validateTypeDefinition,
})

export type Header = z.infer<typeof validateHeader>

export const Header = TypedIdentity<Header>()
