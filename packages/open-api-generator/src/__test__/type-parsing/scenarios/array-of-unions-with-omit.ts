import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { TypeDefinition } from '../../../schema/type-schema'

type SupportedDatatransPaymentMethod =
  | 'VIS'
  | 'ECA'
  | 'PFC'
  | 'TWI'
  | 'REK'
  | 'DIB'
  | 'PAP'
  | 'EPS'

type SupportedPaymentMethod =
  | {
      type: Omit<SupportedDatatransPaymentMethod, 'TWI' | 'REK' | 'DIB' | 'EPS'>
      provider: 'DATATRANS'
      supportsAlias: true
      supportsRegistrationAndPayment: true
    }
  | {
      type: 'TWI'
      provider: 'DATATRANS'
      supportsAlias: true
      supportsRegistrationAndPayment: false
    }

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01').get('/payment-methods').response<{
      paymentMethods: SupportedPaymentMethod[]
    }>()
  )
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {},
    } satisfies TypeDefinition,
    output: {
      kind: 'object',
      properties: {
        paymentMethods: {
          kind: 'array',
          items: {
            kind: 'union',
            types: [
              {
                kind: 'object',
                properties: {
                  type: {
                    kind: 'union',
                    types: [
                      { kind: 'literal', value: 'VIS' },
                      { kind: 'literal', value: 'ECA' },
                      { kind: 'literal', value: 'PFC' },
                      { kind: 'literal', value: 'PAP' },
                    ],
                  },
                  provider: { kind: 'literal', value: 'DATATRANS' },
                  supportsAlias: { kind: 'boolean' },
                  supportsRegistrationAndPayment: { kind: 'boolean' },
                },
                required: [
                  'type',
                  'provider',
                  'supportsAlias',
                  'supportsRegistrationAndPayment',
                ],
              },
              {
                kind: 'object',
                properties: {
                  type: { kind: 'literal', value: 'TWI' },
                  provider: { kind: 'literal', value: 'DATATRANS' },
                  supportsAlias: { kind: 'boolean' },
                  supportsRegistrationAndPayment: { kind: 'boolean' },
                },
                required: [
                  'type',
                  'provider',
                  'supportsAlias',
                  'supportsRegistrationAndPayment',
                ],
              },
            ],
          },
        },
      },
      required: ['paymentMethods'],
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/payment-methods' },
  },
]
