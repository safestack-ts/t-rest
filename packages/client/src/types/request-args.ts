import { RequestConfig } from './request-config.js'

// the request config is optional if every input key is optional, but the
// input keys are kept so that optional query, body or params stay typed
export type RequestArgs<
  TRequestInput,
  TPath extends string,
  TRequestContext
> = {} extends TRequestInput
  ? [
      path: TPath,
      requestConfig?: RequestConfig & TRequestInput & TRequestContext
    ]
  : [
      path: TPath,
      requestConfig: RequestConfig & TRequestInput & TRequestContext
    ]
