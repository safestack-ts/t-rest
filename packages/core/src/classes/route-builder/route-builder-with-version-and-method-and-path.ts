import { BodyEncoding } from '../../types/body-encoding.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import { RouteBuilderWithVersionAndMethodAndPathAndValidator } from './route-builder-with-version-and-method-and-path-and-validator.js'
import { RouteBuilderWithVersionAndMethodAndPathAndMetaData } from './route-builder-with-version-and-method-and-path-and-meta-data.js'
import { emptyValidation } from '../../utils/empty-validation.js'

type BodyMethod = Exclude<HTTPMethod, 'GET' | 'DELETE'>

export class RouteBuilderWithVersionAndMethodAndPath<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TBodyEncoding extends BodyEncoding = 'json'
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private bodyEncoding?: TBodyEncoding
  ) {}

  /**
   * Declares that the route takes `multipart/form-data`. Parsing the upload
   * stays up to a route middleware, the validator describes its result.
   * GET and DELETE never send a body and are rejected.
   */
  public multipart(
    this: RouteBuilderWithVersionAndMethodAndPath<
      TVersion,
      TMethod & BodyMethod,
      TPath,
      TBodyEncoding
    >
  ) {
    return new RouteBuilderWithVersionAndMethodAndPath<
      TVersion,
      TMethod,
      TPath,
      'multipart'
    >(this.version, this.method as TMethod, this.path, 'multipart')
  }

  public validate<TValidator>(validator: TValidator) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidator<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TBodyEncoding
    >(this.version, this.method, this.path, validator, this.bodyEncoding)
  }

  public metaData<TMetaData>(metaData: TMetaData) {
    return new RouteBuilderWithVersionAndMethodAndPathAndMetaData<
      TVersion,
      TMethod,
      TPath,
      TMetaData,
      TBodyEncoding
    >(this.version, this.method, this.path, metaData, this.bodyEncoding)
  }

  public response<TResponse>() {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      typeof emptyValidation,
      TResponse,
      unknown,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      emptyValidation,
      null,
      this.bodyEncoding
    )
  }
}
