import { AnyRouteDef } from '@t-rest/core'
import {
  ExpressNextFunction,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'
import { TypedResponse } from '../types/typed-response.js'
import { createDiscardableTypedResponse } from '../internal/discardable-typed-response.js'

/**
 * Creates the response passed to route handlers. `next` receives the errors of
 * streams and files failing after the handler returned, it has to forward at
 * most one error per request to the error handlers, also when the handler
 * throws as well.
 */
export const createTypedResponse = <TRoute extends AnyRouteDef>(
  res: ExpressResponse,
  route: TRoute,
  next: ExpressNextFunction
): TypedResponse<TRoute> =>
  createDiscardableTypedResponse(res, route, next).response
