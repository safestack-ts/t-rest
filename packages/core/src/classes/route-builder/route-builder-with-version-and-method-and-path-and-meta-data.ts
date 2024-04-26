import { z } from 'zod'
import { HTTPMethod } from '../../types/http-method'
import { RouteDef } from '../core/route-def'
import { RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData } from './route-builder-with-version-and-method-and-path-and-validator-and-meta-data'

export class RouteBuilderWithVersionAndMethodAndPathAndMetaData<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TMetaData
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private metaData: TMetaData
  ) {}

  public validate<TValidator extends z.ZodTypeAny>(validator: TValidator) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TMetaData
    >(this.version, this.method, this.path, validator, this.metaData)
  }

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      z.ZodTypeAny,
      TResponse,
      TMetaData
    >(this.version, this.method, this.path, z.any(), this.metaData)
  }
}
