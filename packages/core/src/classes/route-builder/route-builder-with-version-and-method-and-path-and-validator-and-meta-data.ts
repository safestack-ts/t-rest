import { BodyEncoding } from '../../types/body-encoding.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
export class RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TMetaData,
  TBodyEncoding extends BodyEncoding = 'json'
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private validator: TValidator,
    private metaData: TMetaData,
    private bodyEncoding?: TBodyEncoding
  ) {}

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponse,
      TMetaData,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      this.validator,
      this.metaData,
      this.bodyEncoding
    )
  }
}
