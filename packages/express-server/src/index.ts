/// <reference types="express-serve-static-core" />
/// <reference types="@t-rest/core" />

// classes
export * from './classes/typed-express-application'

// types
export * from './types/version-extractor'
export * from './types/date-version-extractor'
export * from './types/express-type-shortcuts'

// utils
export * from './utils/define-middleware'

// core
// https://github.com/microsoft/TypeScript/issues/42873#issuecomment-2040902002
//export * from '@t-rest/core'
//export {
//  Router as _ExpressRouter,
//  RequestHandler as _ExpressRequestHandler,
//  Request as _ExpressRequest,
//  Response as _ExpressResponse,
//  Application as _ExpressApplication,
//} from 'express-serve-static-core'
