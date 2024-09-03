import { HTTPMethod } from '../../types/http-method'
import { RouteDef } from '../core/route-def'
import { RouteBuilderWithVersionAndMethodAndPathAndValidator } from './route-builder-with-version-and-method-and-path-and-validator'
import { RouteBuilderWithVersionAndMethodAndPathAndMetaData } from './route-builder-with-version-and-method-and-path-and-meta-data'
import { emptyValidation } from '../../utils/empty-validation'
import { AnyRouteValidator } from '../../types/any-route-validator'

export class RouteBuilderWithVersionAndMethodAndPath<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath
  ) {}

  public validate<TValidator extends AnyRouteValidator>(validator: TValidator) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidator<
      TVersion,
      TMethod,
      TPath,
      TValidator
    >(this.version, this.method, this.path, validator)
  }

  public metaData<TMetaData>(metaData: TMetaData) {
    return new RouteBuilderWithVersionAndMethodAndPathAndMetaData<
      TVersion,
      TMethod,
      TPath,
      TMetaData
    >(this.version, this.method, this.path, metaData)
  }

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      typeof emptyValidation,
      TResponse,
      unknown
    >(this.version, this.method, this.path, emptyValidation, null)
  }
}
