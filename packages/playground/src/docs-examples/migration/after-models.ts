import { defineModels } from '@t-rest/core/zod'
import { z } from 'zod'

// the id is set once, where the schema is defined: V2024_01_01_Shared_Address
export const V2024_01_01_Shared = defineModels('V2024_01_01.Shared', {
  Address: z.object({ street: z.string(), city: z.string() }),
})

// a re-export is the same schema object, so it keeps the id
export const V2025_01_01_Customer = {
  Address: V2024_01_01_Shared.Address,
}

// an alias: V2025_01_01_Admin_Address, a component that refers to the shared one
export const V2025_01_01_Admin = defineModels('V2025_01_01.Admin', {
  Address: V2024_01_01_Shared.Address,
})
