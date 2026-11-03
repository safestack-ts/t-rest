import { StandardJSONSchemaV1 } from '@standard-schema/spec'
import { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import { BagOfRoutes } from '../classes/core/bag-of-routes.js'
import { Route } from '../classes/core/route.js'
import {
  BinaryResponseDescriptor,
  BodyOf,
  DecodedBody,
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  TextResponseDescriptor,
} from '../types/response-descriptor.js'
import { RouteOutput } from '../types/route-input-output.js'
import { emptyValidation } from '../utils/empty-validation.js'
import { binary, empty, json, text } from '../utils/response-descriptors.js'

const Person = z.object({ id: z.string(), age: z.string().transform(Number) })
type PersonOutput = { id: string; age: number }

const person = json(Person, {
  description: 'The person',
  headers: z.object({ etag: z.string() }),
  examples: { ada: { summary: 'Ada', value: { id: 'ada', age: 36 } } },
  id: 'Person',
})

type _schemaBody = AssertTrue<
  IsExact<typeof person, JsonResponseDescriptor<PersonOutput>>
>
type _schemaDecodedBody = AssertTrue<
  IsExact<DecodedBody<typeof person>, PersonOutput>
>

const route = Route.get('/persons/:id').responses({
  200: json(Person),
  404: json<{ error: string }>(),
})
type _schemaBodyOf = AssertTrue<
  IsExact<BodyOf<typeof route, 200>, PersonOutput>
>

const bag = BagOfRoutes.withoutVersioning().addRoute(route).build()
type _schemaRouteOutput = AssertTrue<
  IsExact<RouteOutput<typeof bag, 'GET', '/persons/:id', '', 200>, PersonOutput>
>

// @ts-expect-error examples are typed against the output of the schema
json(Person, { examples: { ada: { value: { id: 'ada', age: '36' } } } })

const untyped = json<{ q: 1 }>()
type _untypedUnchanged = AssertTrue<
  IsExact<typeof untyped, JsonResponseDescriptor<{ q: 1 }>>
>

const documented = json<{ q: 1 }>({
  description: 'Docs while migrating',
  examples: { one: { value: { q: 1 } } },
})
type _documentedUntyped = AssertTrue<
  IsExact<typeof documented, JsonResponseDescriptor<{ q: 1 }>>
>

// @ts-expect-error a body type and a schema cannot disagree
json<{ q: 1 }>(Person)
// @ts-expect-error a body type and a schema cannot disagree
json<PersonOutput>(Person)
// @ts-expect-error a body type and a schema cannot disagree
json<{ name?: string }>(Person)
// @ts-expect-error a body type and a schema cannot disagree
json<{}>(Person)
// @ts-expect-error a body type and a schema cannot disagree
json<{ type: string }>(Person)

const csv = text('text/csv', {
  description: 'The report',
  examples: { header: { value: 'id,age' } },
})
type _text = AssertTrue<IsExact<typeof csv, TextResponseDescriptor<'text/csv'>>>
const plain = text(undefined, { description: 'Plain text' })
type _textDefault = AssertTrue<
  IsExact<typeof plain, TextResponseDescriptor<'text/plain'>>
>
declare const maybeCsv: 'text/csv' | undefined
const maybe = text(maybeCsv)
type _textMaybeUndefined = AssertTrue<
  IsExact<typeof maybe, TextResponseDescriptor<'text/csv' | 'text/plain'>>
>
const csvByTypeArgument = text<'text/csv'>()
type _textTypeArgumentOnly = AssertTrue<
  IsExact<
    typeof csvByTypeArgument,
    TextResponseDescriptor<'text/csv' | 'text/plain'>
  >
>
// @ts-expect-error text examples are strings
text('text/csv', { examples: { one: { value: 1 } } })

const pdf = binary('application/pdf', {
  description: 'The invoice',
  headers: z.object({ 'content-disposition': z.string() }),
})
type _binary = AssertTrue<
  IsExact<typeof pdf, BinaryResponseDescriptor<'application/pdf'>>
>
// @ts-expect-error binary bodies have no examples
binary('application/pdf', { examples: { one: { value: 'x' } } })

const noContent = empty({ description: 'Deleted' })
type _empty = AssertTrue<IsExact<typeof noContent, EmptyResponseDescriptor>>
// @ts-expect-error empty bodies have no examples
empty({ examples: { one: { value: undefined } } })

const _emptyValidationJsonSchema: StandardJSONSchemaV1<{}> = emptyValidation

type _instantiationExpression = AssertTrue<
  IsExact<ReturnType<typeof json<{ q: 1 }>>, JsonResponseDescriptor<{ q: 1 }>>
>
