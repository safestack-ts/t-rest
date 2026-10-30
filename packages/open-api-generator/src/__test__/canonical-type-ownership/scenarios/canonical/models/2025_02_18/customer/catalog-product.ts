import type { Catalog as SharedCatalog } from '../../shared/catalog-product.js'

export namespace Catalog {
  export type ProductCategory = SharedCatalog.ProductCategory
}

export type ProductCategory = Catalog.ProductCategory
