import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from '@standard-schema/spec'
import { BagOfRoutes, json, Route } from '@t-rest/core'
import { buildOpenAPI } from '@t-rest/open-api-generator'

interface Point {
  x: number
  y: number
}

const pointJsonSchema = {
  $ref: '#/$defs/Geo_Point',
  $defs: {
    Geo_Point: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
      required: ['x', 'y'],
    },
  },
}

const isPoint = (value: unknown): value is Point =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Point).x === 'number' &&
  typeof (value as Point).y === 'number'

// what a schema library provides: validation and both JSON Schema directions
export const Point: StandardSchemaV1<Point> & StandardJSONSchemaV1<Point> = {
  '~standard': {
    version: 1,
    vendor: 'geo-schema',
    validate: (value) =>
      isPoint(value) ? { value } : { issues: [{ message: 'Not a point' }] },
    jsonSchema: {
      input: () => pointJsonSchema,
      output: () => pointJsonSchema,
    },
  },
}

export const bag = BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/origin').responses({ 200: json(Point) }))
  .build()

// Geo_Point becomes a component; without the trust entry it is inlined
export const build = buildOpenAPI({
  bag,
  info: { title: 'Geo API' },
  vendors: { trust: ['geo-schema'] },
  specs: [{ target: '3.1', output: 'openapi/geo.yaml' }],
})
