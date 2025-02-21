import { HTTPMethod } from '../../types/http-method'
import { RouteDef } from '../core/route-def'
import { RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData } from './route-builder-with-version-and-method-and-path-and-validator-and-meta-data'

export class RouteBuilderWithVersionAndMethodAndPathAndValidator<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private validator: TValidator
  ) {}

  public metaData<TMetaData>(metaData: TMetaData) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TMetaData
    >(this.version, this.method, this.path, this.validator, metaData)
  }

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponse,
      unknown
    >(this.version, this.method, this.path, this.validator, null)
  }
}
