import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'
import { TypedMiddleware } from '../types/typed-middleware.js'
import { TypedRequestHandler } from '../types/typed-request-handler.js'

export const defineMiddleware =
  <TRequestIn extends ExpressRequest, TRequestOut>(
    middlewareFn: TypedRequestHandler<TRequestIn>
  ): TypedMiddleware<TRequestIn, TRequestOut> =>
  (
    request: TRequestIn,
    response: ExpressResponse,
    next: ExpressNextFunction
  ) => {
    const result = middlewareFn(request, response, next)

    // forward async errors to express, which does not handle rejected promises itself
    if (result instanceof Promise) {
      return result.catch(next)
    }

    return result
  }
