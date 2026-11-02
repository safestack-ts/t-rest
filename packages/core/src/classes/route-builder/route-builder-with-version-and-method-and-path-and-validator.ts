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

  public responses<TResponses extends StrictResponseMap<TResponses>>(
    responses: TResponses
  ) {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TResponses,
      unknown
    >(this.version, this.method, this.path, this.validator, responses, null)
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
    unknown
  >
  public response<TResponse>(
    status: 201
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    TValidator,
    { 201: JsonResponseDescriptor<TResponse> },
    unknown
  >
  public response<TResponse>(
    status: 202
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    TValidator,
    { 202: JsonResponseDescriptor<TResponse> },
    unknown
  >
  public response(
    status: 204
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    TValidator,
    { 204: EmptyResponseDescriptor },
    unknown
  >
  public response(status: ShorthandStatus = 200) {
    return this.responses(shorthandResponses(status))
  }
}
