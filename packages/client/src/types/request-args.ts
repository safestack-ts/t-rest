import { RequestConfig } from './request-config'

// @todo add type tests
export type RequestArgs<
  TRequestInput,
  TPath extends string,
  TRequestContext
> = {} extends TRequestInput
  ? [path: TPath, requestConfig?: RequestConfig & TRequestContext]
  : [
      path: TPath,
      requestConfig: RequestConfig & TRequestInput & TRequestContext
    ]
