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
    middlewareFn(request, response, next)
  }
