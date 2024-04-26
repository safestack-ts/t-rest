import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from './express-type-shortcuts'

export type TypedRequestHandler<TRequest extends ExpressRequest> = (
  request: TRequest,
  response: ExpressResponse,
  next: ExpressNextFunction
) => void | Promise<void>
