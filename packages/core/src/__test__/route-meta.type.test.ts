import { AssertTrue, IsExact } from 'conditional-type-checks'
import { z } from 'zod'
import { Route } from '../classes/core/route.js'
import { InferMetaData } from '../types/infer-meta-data.js'
import { RouteMeta } from '../types/route-meta.js'
import { SecurityRequirements } from '../types/security-scheme.js'
import { securityScheme } from '../utils/security-scheme.js'

const publicRoute = Route.get('/').metaData({ public: true }).response()
type _extraKeyAlone = AssertTrue<
  IsExact<InferMetaData<typeof publicRoute>, { public: boolean }>
>

const documented = Route.get('/')
  .validate(z.object({}))
  .metaData({ summary: 's', public: true })
  .response()
type _knownAndExtraKeys = AssertTrue<
  IsExact<
    InferMetaData<typeof documented>,
    { summary: string; public: boolean }
  >
>

const shared = { tags: ['users'], public: false }
const fromVariable = Route.get('/').metaData(shared).response()
type _sharedVariable = AssertTrue<
  IsExact<InferMetaData<typeof fromVariable>, typeof shared>
>

interface DocumentedMeta {
  summary: string
  owner: string
}
declare const interfaceMeta: DocumentedMeta
const fromInterface = Route.get('/').metaData(interfaceMeta).response()
type _interfaceValue = AssertTrue<
  IsExact<InferMetaData<typeof fromInterface>, DocumentedMeta>
>

// @ts-expect-error known keys keep their type
Route.get('/').metaData({ tags: 'x' })
// @ts-expect-error known keys keep their type
Route.get('/').validate(null).metaData({ deprecated: 'yes' })

const withoutMeta = Route.get('/').response()
type _withoutMetaUnchanged = AssertTrue<
  IsExact<InferMetaData<typeof withoutMeta>, unknown>
>

const bearer = securityScheme('bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})
const oauth = securityScheme('oauth', {
  type: 'oauth2',
  flows: {
    clientCredentials: {
      tokenUrl: '/token',
      scopes: { 'read:me': 'Read the profile', 'write:me': 'Edit it' },
    },
  },
})

type _schemeName = AssertTrue<IsExact<typeof bearer.name, 'bearer'>>

Route.get('/').metaData({ security: [[bearer]] })
Route.get('/').metaData({ security: [] })
Route.get('/').metaData({ security: [[bearer], []] })
Route.get('/').metaData({ security: [[bearer, oauth.scopes('read:me')]] })
Route.get('/').metaData({ security: [[oauth.scopes('read:me', 'write:me')]] })
// @ts-expect-error scopes are typed against the declared scopes
oauth.scopes('admin')
// @ts-expect-error only security schemes are requirements
Route.get('/').metaData({ security: [['bearer']] })
// @ts-expect-error a requirement is a list of schemes
Route.get('/').metaData({ security: [bearer] })
const _plainScheme: SecurityRequirements = [
  [
    // @ts-expect-error security schemes are created by securityScheme()
    {
      name: 'bearer',
      spec: { type: 'http', scheme: 'bearer' },
      scopes: () => ({ scheme: bearer, scopes: [] }),
    },
  ],
]

const _meta: RouteMeta = {
  summary: 'Get a person',
  description: 'Returns the person',
  tags: ['persons'],
  deprecated: false,
  operationId: 'getPerson',
  externalDocs: { url: 'https://example.com', description: 'Docs' },
  servers: [{ url: 'https://api.example.com', description: 'Production' }],
  security: [[bearer], []],
}

const Params = z.object({
  params: z.object({ id: z.string().transform(Number) }),
})

Route.get('/persons/:id').validate(Params, {
  examples: { ada: { summary: 'Ada', value: { params: { id: '1' } } } },
})
Route.get('/persons/:id')
  .metaData({ summary: 's' })
  .validate(Params, { examples: { ada: { value: { params: { id: '1' } } } } })
Route.get('/persons/:id').validate(Params, {
  // @ts-expect-error request examples are typed against the validator input
  examples: { ada: { value: { params: { id: 1 } } } },
})
Route.get('/').validate({})
Route.get('/').validate(null)
