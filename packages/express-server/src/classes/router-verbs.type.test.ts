import { HTTP_METHODS } from '@t-rest/protocol'
import { TypedRouterWithVersioning } from './typed-router-with-versioning.js'
import { TypedRouterWithoutVersioning } from './typed-router-without-versioning.js'

type Verb = Lowercase<(typeof HTTP_METHODS)[number]>

type HasEveryVerb<TRouter> = [Verb] extends [keyof TRouter] ? true : never

// fails to compile if a router lacks a method for one of the http methods
const _withVersioning: HasEveryVerb<
  TypedRouterWithVersioning<any, any, any, any>
> = true
const _withoutVersioning: HasEveryVerb<
  TypedRouterWithoutVersioning<any, any, any>
> = true

export { _withVersioning, _withoutVersioning }
