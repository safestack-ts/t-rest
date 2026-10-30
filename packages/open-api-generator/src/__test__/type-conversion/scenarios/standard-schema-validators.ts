import { BagOfRoutes, Route } from '@t-rest/core'

type Input = { body: { name: string } }
type Output = { body: { name: string; normalized: true } }

const validate = (value: unknown) => ({ value: value as Output })

// hand-written Standard Schema validators, without zod
const optionalTypesValidator: {
  '~standard': {
    version: 1
    vendor: 'custom'
    validate: typeof validate
    types?: { input: Input; output: Output }
  }
} = { '~standard': { version: 1, vendor: 'custom', validate } }

const requiredTypesValidator: {
  '~standard': {
    version: 1
    vendor: 'custom'
    validate: typeof validate
    types: { readonly input: Input; readonly output: Output }
  }
} = {
  '~standard': {
    version: 1,
    vendor: 'custom',
    validate,
    types: {} as { input: Input; output: Output },
  },
}

const untypedValidator: {
  '~standard': { version: 1; vendor: 'custom'; validate: typeof validate }
} = { '~standard': { version: 1, vendor: 'custom', validate } }

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/optional-types')
      .validate(optionalTypesValidator)
      .response<void>()
  )
  .addRoute(
    Route.post('/required-types')
      .validate(requiredTypesValidator)
      .response<void>()
  )
  .addRoute(Route.post('/untyped').validate(untypedValidator).response<void>())
  .build()
