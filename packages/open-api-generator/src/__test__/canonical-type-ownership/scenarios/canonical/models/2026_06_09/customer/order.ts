import type * as Checkout2024_01_01 from '../../2024_01_01/customer/checkout.js'
import type * as CatalogProduct2025_02_18 from '../../2025_02_18/customer/catalog-product.js'

interface TransportResponse<T> {
  data: T
}

interface InternalOrderMetadata {
  source: string
}

export interface Order {
  promoCodes: Checkout2024_01_01.PromoCode[]
  promoCodesWithoutCode: Omit<Checkout2024_01_01.PromoCode, 'code'>[]
  promoCodePreview: Pick<Checkout2024_01_01.PromoCodeValid, 'code'>
  promoCodesById: Record<string, Checkout2024_01_01.PromoCode>
  promoCodesWithSource: Array<Checkout2024_01_01.PromoCode & { source: string }>
  nestedResponse: TransportResponse<Checkout2024_01_01.PromoCode>
  category: CatalogProduct2025_02_18.Catalog.ProductCategory
  metadata: InternalOrderMetadata
}
