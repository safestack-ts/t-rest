import { ExtractPathParams } from './extract-path-params'
import { AnyRouteValidator } from './any-route-validator'
import type { StandardSchemaV1 } from '@standard-schema/spec'

export type PathParamsMatchingRouteValidator<TPath extends string> =
  {} extends ExtractPathParams<TPath>
    ? AnyRouteValidator
    : StandardSchemaV1<{
        params: ExtractPathParams<TPath>
        query?: StandardSchemaV1.InferInput<AnyRouteValidator>['query']
        body?: StandardSchemaV1.InferInput<AnyRouteValidator>['body']
        headers?: StandardSchemaV1.InferInput<AnyRouteValidator>['headers']
      }>
