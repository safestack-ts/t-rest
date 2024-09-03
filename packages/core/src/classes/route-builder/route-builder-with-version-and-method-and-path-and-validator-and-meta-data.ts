import { HTTPMethod } from '../../types/http-method'
import { RouteDef } from '../core/route-def'
import { AnyRouteValidator } from '../../types/any-route-validator'

export class RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator extends AnyRouteValidator,
  TMetaData
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private validator: TValidator,
    private metaData: TMetaData
  ) {}

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponse,
      TMetaData
    >(this.version, this.method, this.path, this.validator, this.metaData)
  }
}
