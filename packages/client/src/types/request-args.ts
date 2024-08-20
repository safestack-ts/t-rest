import { RequestConfig } from './request-config'

// @todo add type tests
export type RequestArgs<
  TRequestInput,
  TPath extends string
> = {} extends TRequestInput
  ? [path: TPath, requestConfig?: RequestConfig]
  : [path: TPath, requestConfig: RequestConfig & TRequestInput]
