import {
  TypedExpressApplicationWithoutVersioning,
  TypedExpressApplicationWithVersioning,
} from '@t-rest/express-server'

export type AnyTypedExpressApplication =
  | TypedExpressApplicationWithoutVersioning<any, any, any>
  | TypedExpressApplicationWithVersioning<any, any, any, any>
