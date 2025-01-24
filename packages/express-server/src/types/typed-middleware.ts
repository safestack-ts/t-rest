import { ExpressRequest } from './express-type-shortcuts'
import { TypedRequestHandler } from './typed-request-handler'

export type TypedMiddleware<
  TRequestIn extends ExpressRequest,
  _TRequestOut
> = TypedRequestHandler<TRequestIn>
