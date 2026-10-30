import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import { ResponseMap } from '../../types/response-descriptor.js'
import { json } from '../../utils/response-descriptors.js'
import { RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData } from './route-builder-with-version-and-method-and-path-and-validator-and-meta-data.js'

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

  public responses<TResponses extends ResponseMap>(responses: TResponses) {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponses,
      unknown
    >(this.version, this.method, this.path, this.validator, responses, null)
  }

  /** Shorthand for `.responses({ 200: json<TResponse>() })`. */
  public response<TResponse>() {
    return this.responses({ 200: json<TResponse>() })
  }
}
