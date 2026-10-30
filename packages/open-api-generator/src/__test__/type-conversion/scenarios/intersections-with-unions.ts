import { BagOfRoutes, Route } from '@t-rest/core'

type Base = { id: number }
type Bundle = { type: 'bundle'; items: string[] }
type Single = { type: 'single'; item: string }

type Product = Base & (Bundle | Single)

class Money {
  amount = 0
  currency = 'CHF'
}

interface Labelled {
  label: string
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/intersections-with-unions').response<{
      product: Product
      nullableProduct: (Base & (Bundle | Single)) | null
      price: Money
      labelled: Labelled & { color: string | null }
    }>()
  )
  .build()
