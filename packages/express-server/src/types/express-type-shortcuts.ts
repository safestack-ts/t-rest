import * as Express from 'express'

export type ExpressRequest = Express.Request
export type ExpressResponse<TBody = any> = Express.Response<TBody>
export type ExpressNextFunction = Express.NextFunction
export type ExpressRouter = Express.Router
export type ExpressRequestHandler = Express.RequestHandler
export type ExpressApp = Express.Application
