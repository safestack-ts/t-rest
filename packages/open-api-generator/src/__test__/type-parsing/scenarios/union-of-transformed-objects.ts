import { BagOfRoutes, Route, versionHistory, Versioning } from '@t-rest/core'
import { z } from 'zod'
import { TypeDefinition } from '../../../schema/type-schema.js'

const keycardValidationSchema = z.object({
  query: z.object({
    personId: z.string(),
  }),
  body: z.union([
    z
      .object({
        type: z.literal('SWISSTRAVELPASS'),
        dataCarrierId: z.string(),
        validity: z.object({
          from: z.string(),
          to: z.string(),
        }),
      })
      .transform(({ type, dataCarrierId, ...rest }) => ({
        keycardType: type,
        cardId: dataCarrierId,
        ...rest,
      })),
    z
      .object({
        type: z.literal('EUINTERRAIL'),
        dataCarrierId: z.string(),
        validity: z.object({
          from: z.string(),
          to: z.string(),
        }),
      })
      .transform(({ type, dataCarrierId, ...rest }) => ({
        keycardType: type,
        passId: dataCarrierId,
        ...rest,
      })),
    z
      .object({
        type: z.literal('SWISSPASS'),
        zip: z.string(),
        dataCarrierId: z.string(),
      })
      .transform(({ type, dataCarrierId, ...rest }) => ({
        keycardType: type,
        ausweisId: dataCarrierId,
        ...rest,
      })),
    z
      .object({
        type: z.literal('SKIDATA'),
        dataCarrierId: z.string(),
      })
      .transform(({ type, dataCarrierId, ...rest }) => ({
        keycardType: type,
        dataCarrierId,
        ...rest,
      })),
    z
      .object({
        type: z.literal('AXESS'),
        dataCarrierId: z.string(),
      })
      .transform(({ type, dataCarrierId, ...rest }) => ({
        keycardType: type,
        wtp: dataCarrierId,
        ...rest,
      })),
    z
      .object({
        type: z.literal('LICENSEPLATE'),
        dataCarrierId: z.string(),
        countryCode: z.string(),
      })
      .transform(({ type, dataCarrierId, ...rest }) => ({
        keycardType: type,
        licensePlate: dataCarrierId,
        ...rest,
      })),
    z
      .object({
        type: z.literal('FERATEL'),
        dataCarrierId: z.string(),
      })
      .transform(({ type, dataCarrierId }) => ({
        keycardType: type,
        cardId: dataCarrierId,
      })),
  ]),
})

export default BagOfRoutes.withVersioning(Versioning.DATE, versionHistory)
  .addRoute(
    Route.version('2024-01-01')
      .post('/keycards')
      .validate(keycardValidationSchema)
      .response<{ success: boolean }>()
  )
  .build()

export const expectedResult = [
  {
    input: {
      kind: 'object',
      properties: {
        query: {
          kind: 'object',
          properties: {
            personId: { kind: 'string' },
          },
          required: ['personId'],
        },
        body: {
          kind: 'union',
          types: [
            {
              kind: 'object',
              properties: {
                keycardType: {
                  kind: 'literal',
                  value: 'SWISSTRAVELPASS',
                },
                cardId: { kind: 'string' },
                validity: {
                  kind: 'object',
                  properties: {
                    from: { kind: 'string' },
                    to: { kind: 'string' },
                  },
                  required: ['from', 'to'],
                },
              },
              required: ['validity', 'keycardType', 'cardId'],
            },
            {
              kind: 'object',
              properties: {
                keycardType: {
                  kind: 'literal',
                  value: 'EUINTERRAIL',
                },
                passId: { kind: 'string' },
                validity: {
                  kind: 'object',
                  properties: {
                    from: { kind: 'string' },
                    to: { kind: 'string' },
                  },
                  required: ['from', 'to'],
                },
              },
              required: ['validity', 'keycardType', 'passId'],
            },
            {
              kind: 'object',
              properties: {
                keycardType: {
                  kind: 'literal',
                  value: 'SWISSPASS',
                },
                ausweisId: { kind: 'string' },
                zip: { kind: 'string' },
              },
              required: ['zip', 'keycardType', 'ausweisId'],
            },
            {
              kind: 'object',
              properties: {
                keycardType: {
                  kind: 'literal',
                  value: 'SKIDATA',
                },
                dataCarrierId: { kind: 'string' },
              },
              required: ['keycardType', 'dataCarrierId'],
            },
            {
              kind: 'object',
              properties: {
                keycardType: {
                  kind: 'literal',
                  value: 'AXESS',
                },
                wtp: { kind: 'string' },
              },
              required: ['keycardType', 'wtp'],
            },
            {
              kind: 'object',
              properties: {
                keycardType: {
                  kind: 'literal',
                  value: 'LICENSEPLATE',
                },
                licensePlate: { kind: 'string' },
                countryCode: { kind: 'string' },
              },
              required: ['countryCode', 'keycardType', 'licensePlate'],
            },
            {
              kind: 'object',
              properties: {
                keycardType: {
                  kind: 'literal',
                  value: 'FERATEL',
                },
                cardId: { kind: 'string' },
              },
              required: ['keycardType', 'cardId'],
            },
          ],
        },
      },
      required: ['query', 'body'],
    } satisfies TypeDefinition,
    output: {
      kind: 'object',
      properties: {
        success: { kind: 'boolean' },
      },
      required: ['success'],
    } satisfies TypeDefinition,
    routeMeta: { originalPath: '/keycards' },
  },
]
