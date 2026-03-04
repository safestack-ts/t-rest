import { ExpressRequest } from './express-type-shortcuts.js'
import { TypedRequestHandler } from './typed-request-handler.js'

export type TypedMiddleware<
  TRequestIn extends ExpressRequest,
  _TRequestOut
> = TypedRequestHandler<TRequestIn>
