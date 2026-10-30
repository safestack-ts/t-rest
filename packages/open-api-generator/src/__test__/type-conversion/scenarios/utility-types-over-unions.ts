import { BagOfRoutes, Route } from '@t-rest/core'

type CardPayment = { kind: 'card'; id: string; last4: string }
type InvoicePayment = { kind: 'invoice'; id: string; dueAt: Date | null }
type Payment = CardPayment | InvoicePayment

type Status = 'draft' | 'paid' | 'void'

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/utility-types').response<{
      noKeys: Record<never, string>
      withoutId: Omit<Payment, 'id'>
      onlyKind: Pick<Payment, 'kind'>
      openStatuses: Omit<Status, 'void'>
      byStatus: Record<Status, number>
    }>()
  )
  .build()
