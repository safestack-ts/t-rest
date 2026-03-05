import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'

namespace CatalogAlpha {
  export type ProductCategory = {
    id: number
    name: string
  }

  export const ExternalTicketStatus = {
    PRODUCED: 'PRODUCED',
    RESERVED: 'RESERVED',
    CANCELLED: 'CANCELLED',
    USED: 'USED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    BLOCKED: 'BLOCKED',
    REFUNDED: 'REFUNDED',
  } as const
  
  export type ExternalTicketStatus = (typeof ExternalTicketStatus)[keyof typeof ExternalTicketStatus]

  export const ExternalTicketSystem = {
    AXESS: 'AXESS',
    EPS: 'EPS',
    ECOPARK: 'ECOPARK',
    NOVATOUCH: 'NOVATOUCH',
    PRICENOW: 'PRICENOW',
    SKIDATA: 'SKIDATA',
    VISUAL: 'VISUAL',
    ALENO: 'ALENO',
    KUBEOS: 'KUBEOS',
    CAPAZIP: 'CAPAZIP',
    SIMPHONY: 'SIMPHONY',
    SENSIBLE_WEATHER: 'SENSIBLE_WEATHER',
    // deprecated
    INTERMAPS: 'INTERMAPS',
  } as const

  export type ExternalTicketSystem = (typeof ExternalTicketSystem)[keyof typeof ExternalTicketSystem]

  export const ExternalTicketType = {
    CODE: 'CODE',
    DATACARRIER: 'DATACARRIER',
    MERCHANDISE: 'MERCHANDISE',
    OTHER: 'OTHER',
    SEND: 'SEND',
  } as const

  export type ExternalTicketType = (typeof ExternalTicketType)[keyof typeof ExternalTicketType]

  export const CodeType = {
    CODE_39: 'CODE_39',
    CODE_128: 'CODE_128',
    INTERLEAVED_2_OF_5: 'INTERLEAVED_2_OF_5', // SKIDATA Barcode
    STANDARD_2_OF_5: 'STANDARD_2_OF_5',
    UPC: 'UPC',
    QR: 'QR',
    DATA_MATRIX: 'DATA_MATRIX',
    PDF_417: 'PDF_417',
    EAN: 'EAN',
    AZTEC: 'AZTEC',
  } as const
  
  export type CodeType = (typeof CodeType)[keyof typeof CodeType]

  export type ExternalTicketItemDebugInformation = {
    kind: 'creation' | 'cancellation' | 'update' | 'get'
    error: Record<string, unknown> | string
  }

  export type ExternalTicketItem = {
    id: number
    createdAt: Date
    updatedAt: Date
    accountId: number
    orderItemId: number | null
    orderId: number
    status: ExternalTicketStatus
    canceledAt: Date | null
    system: ExternalTicketSystem
    type: ExternalTicketType
    code: string | null
    codeType: CodeType | null
    descriptor: string | null
    metaData: unknown
    debug: ExternalTicketItemDebugInformation[]
  }
}

namespace CatalogBeta {
  export type ProductCategory = {
    name: string
    id: number
  }

  export type ExternalTicketItem = CatalogAlpha.ExternalTicketItem
}

const bagOfRoutes = BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .get('/categories/source-a')
      .validate(z.object({}))
      .response<CatalogAlpha.ProductCategory>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/categories/source-b')
      .validate(z.object({}))
      .response<CatalogBeta.ProductCategory>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/tickets/source-a')
      .validate(z.object({}))
      .response<CatalogAlpha.ExternalTicketItem>()
  )
  .addRoute(
    Route.version('2024-01-01')
      .get('/tickets/source-b')
      .validate(z.object({}))
      .response<CatalogBeta.ExternalTicketItem>()
  )
  .build()

export default bagOfRoutes
