import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts'
import { TypedMiddleware } from '../types/typed-middleware'
import { TypedRequestHandler } from '../types/typed-request-handler'

export const defineMiddleware =
  <TRequestIn extends ExpressRequest, TRequestOut extends TRequestIn>(
    middlewareFn: TypedRequestHandler<TRequestIn>
  ): TypedMiddleware<TRequestIn, TRequestOut> =>
  (
    request: TRequestIn,
    response: ExpressResponse,
    next: ExpressNextFunction
  ) => {
    middlewareFn(request, response, next)
  }
