import { defineModels } from '@t-rest/core/zod'
import { z } from 'zod'

// ids V2024_01_01_Shared_Address and V2024_01_01_Shared_Contact
export const { Address, Contact } = defineModels('V2024_01_01.Shared', {
  Address: z.object({ street: z.string(), city: z.string() }),
  Contact: z.object({ email: z.email(), phone: z.string().optional() }),
})
