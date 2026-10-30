import { BodyEncoding } from '../../types/body-encoding.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import { RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData } from './route-builder-with-version-and-method-and-path-and-validator-and-meta-data.js'
import { emptyValidation } from '../../utils/empty-validation.js'

export class RouteBuilderWithVersionAndMethodAndPathAndMetaData<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TMetaData,
  TBodyEncoding extends BodyEncoding = 'json'
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private metaData: TMetaData,
    private bodyEncoding?: TBodyEncoding
  ) {}

  public validate<TValidator>(validator: TValidator) {
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
      validator,
      this.metaData,
      this.bodyEncoding
    )
  }

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      typeof emptyValidation,
      TResponse,
      TMetaData,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      emptyValidation,
      this.metaData,
      this.bodyEncoding
    )
  }
}
