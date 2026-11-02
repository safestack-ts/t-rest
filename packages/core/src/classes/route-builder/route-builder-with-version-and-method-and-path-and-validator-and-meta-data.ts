import { BodyEncoding } from '../../types/body-encoding.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import {
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  StrictResponseMap,
} from '../../types/response-descriptor.js'
import {
  shorthandResponses,
  ShorthandStatus,
} from '../../internal/response-shorthand.js'
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

  public responses<TResponses extends StrictResponseMap<TResponses>>(
    responses: TResponses
  ) {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponses,
      TMetaData,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      this.validator,
      responses,
      this.metaData,
      this.bodyEncoding
    )
  }

  /**
   * Shorthand for `.responses({ [status]: json<TResponse>() })`, the status
   * defaults to `200`. `.response(204)` declares an empty body.
   */
  public response<TResponse>(
    status?: 200
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    TValidator,
    { 200: JsonResponseDescriptor<TResponse> },
    TMetaData,
    TBodyEncoding
  >
  public response<TResponse>(
    status: 201
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    TValidator,
    { 201: JsonResponseDescriptor<TResponse> },
    TMetaData,
    TBodyEncoding
  >
  public response<TResponse>(
    status: 202
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    TValidator,
    { 202: JsonResponseDescriptor<TResponse> },
    TMetaData,
    TBodyEncoding
  >
  public response(
    status: 204
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    TValidator,
    { 204: EmptyResponseDescriptor },
    TMetaData,
    TBodyEncoding
  >
  public response(status: ShorthandStatus = 200) {
    return this.responses(shorthandResponses(status))
  }
}
