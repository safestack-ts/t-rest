import { json, Route } from '@t-rest/core'
import { V2025_01_01_Admin, V2025_01_01_Customer } from './after-models.js'

export const getAddress = Route.version('2025-01-01')
  .get('/me/address')
  .responses({ 200: json(V2025_01_01_Customer.Address) })

export const getCustomerAddress = Route.version('2025-01-01')
  .get('/admin/customers/:customerId/address')
  .responses({ 200: json(V2025_01_01_Admin.Address) })
