import { AnyRouteDef, ResponseTypeKey } from '@typed-rest/core'

type RequestReturnType<TData> =
  | {
      data: TData
      statusCode?: number
    }
  | {
      data?: TData
      customize: (
        response: Express.Response,
        data?: TData
      ) => void | Promise<void>
      statusCode?: number
    }

export type HandlerReturnType<TRoute extends AnyRouteDef> = RequestReturnType<
  TRoute[ResponseTypeKey]
>
