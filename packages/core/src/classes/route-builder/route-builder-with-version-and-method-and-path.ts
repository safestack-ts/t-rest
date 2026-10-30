import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import { ResponseMap } from '../../types/response-descriptor.js'
import { json } from '../../utils/response-descriptors.js'
import { RouteBuilderWithVersionAndMethodAndPathAndValidator } from './route-builder-with-version-and-method-and-path-and-validator.js'
import { RouteBuilderWithVersionAndMethodAndPathAndMetaData } from './route-builder-with-version-and-method-and-path-and-meta-data.js'
import { emptyValidation } from '../../utils/empty-validation.js'

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

  public validate<TValidator>(validator: TValidator) {
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

  public responses<TResponses extends ResponseMap>(responses: TResponses) {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      typeof emptyValidation,
      TResponses,
      unknown
    >(this.version, this.method, this.path, emptyValidation, responses, null)
  }

  /** Shorthand for `.responses({ 200: json<TResponse>() })`. */
  public response<TResponse>() {
    return this.responses({ 200: json<TResponse>() })
  }
}
