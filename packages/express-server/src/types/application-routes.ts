import { TypedExpressApplicationWithVersioning } from '../classes/typed-express-application-with-versioning'
import { TypedExpressApplicationWithoutVersioning } from '../classes/typed-express-application-without-versioning'

export type ApplicationRoutes<
  TApp extends
    | TypedExpressApplicationWithVersioning<any, any, any, any>
    | TypedExpressApplicationWithoutVersioning<any, any, any>
> = TApp extends TypedExpressApplicationWithVersioning<
  infer TRoutes,
  any,
  any,
  any
>
  ? TRoutes
  : TApp extends TypedExpressApplicationWithoutVersioning<
      infer TRoutes,
      any,
      any
    >
  ? TRoutes
  : never
