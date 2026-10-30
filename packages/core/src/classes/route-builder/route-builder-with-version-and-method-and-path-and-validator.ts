import { BodyEncoding } from '../../types/body-encoding.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import { RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData } from './route-builder-with-version-and-method-and-path-and-validator-and-meta-data.js'

export class RouteBuilderWithVersionAndMethodAndPathAndValidator<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TBodyEncoding extends BodyEncoding = 'json'
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private validator: TValidator,
    private bodyEncoding?: TBodyEncoding
  ) {}

  public metaData<TMetaData>(metaData: TMetaData) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TMetaData,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      this.validator,
      metaData,
      this.bodyEncoding
    )
  }

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponse,
      unknown,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      this.validator,
      null,
      this.bodyEncoding
    )
  }
}
