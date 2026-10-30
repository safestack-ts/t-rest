import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import { ResponseMap } from '../../types/response-descriptor.js'
import { json } from '../../utils/response-descriptors.js'
export class RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TMetaData
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private validator: TValidator,
    private metaData: TMetaData
  ) {}

  public responses<TResponses extends ResponseMap>(responses: TResponses) {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponses,
      TMetaData
    >(
      this.version,
      this.method,
      this.path,
      this.validator,
      responses,
      this.metaData
    )
  }

  /** Shorthand for `.responses({ 200: json<TResponse>() })`. */
  public response<TResponse>() {
    return this.responses({ 200: json<TResponse>() })
  }
}
