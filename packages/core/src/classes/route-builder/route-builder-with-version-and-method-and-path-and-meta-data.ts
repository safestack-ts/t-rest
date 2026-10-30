import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import { ResponseMap } from '../../types/response-descriptor.js'
import { json } from '../../utils/response-descriptors.js'
import { RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData } from './route-builder-with-version-and-method-and-path-and-validator-and-meta-data.js'
import { emptyValidation } from '../../utils/empty-validation.js'

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

  public validate<TValidator>(validator: TValidator) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TMetaData
    >(this.version, this.method, this.path, validator, this.metaData)
  }

  public responses<TResponses extends ResponseMap>(responses: TResponses) {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      typeof emptyValidation,
      TResponses,
      TMetaData
    >(
      this.version,
      this.method,
      this.path,
      emptyValidation,
      responses,
      this.metaData
    )
  }

  /** Shorthand for `.responses({ 200: json<TResponse>() })`. */
  public response<TResponse>() {
    return this.responses({ 200: json<TResponse>() })
  }
}
