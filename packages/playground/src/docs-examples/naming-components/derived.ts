import { z } from 'zod'
import { Customer } from './ids.js'

// no id: zod does not carry the id of Customer over, so this is inlined
export const CustomerWithNotes = Customer.extend({ notes: z.string() })

// its own id: a component of its own
export const CustomerDetails = Customer.extend({ notes: z.string() }).meta({
  id: 'Shop_CustomerDetails',
})
