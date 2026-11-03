import { json, Route } from '@t-rest/core'

export namespace V2024_01_01.Shared {
  export interface Address {
    street: string
    city: string
  }
}

// 2025-01-01 re-exports the 2024 address for customers and admins
export namespace V2025_01_01.Customer {
  export type Address = V2024_01_01.Shared.Address
}
export namespace V2025_01_01.Admin {
  export type Address = V2024_01_01.Shared.Address
}

export const getAddress = Route.version('2025-01-01')
  .get('/me/address')
  .responses({ 200: json<V2025_01_01.Customer.Address>() })

export const getCustomerAddress = Route.version('2025-01-01')
  .get('/admin/customers/:customerId/address')
  .responses({ 200: json<V2025_01_01.Admin.Address>() })
