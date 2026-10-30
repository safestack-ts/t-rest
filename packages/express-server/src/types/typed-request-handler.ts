import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from './express-type-shortcuts.js'

// returns `unknown` like express 5's RequestHandler, so plain express
// handlers of both express 4 and 5 can be used as typed middlewares
export type TypedRequestHandler<TRequest extends ExpressRequest> = (
  request: TRequest,
  response: ExpressResponse,
  next: ExpressNextFunction
) => unknown
