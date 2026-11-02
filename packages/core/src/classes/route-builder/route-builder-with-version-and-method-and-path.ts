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

  public responses<TResponses extends StrictResponseMap<TResponses>>(
    responses: TResponses
  ) {
    return new RouteDef<
      TVersion,
      TMethod,
      TPath,
      typeof emptyValidation,
      TResponses,
      unknown
    >(this.version, this.method, this.path, emptyValidation, responses, null)
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
    typeof emptyValidation,
    { 200: JsonResponseDescriptor<TResponse> },
    unknown
  >
  public response<TResponse>(
    status: 201
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    typeof emptyValidation,
    { 201: JsonResponseDescriptor<TResponse> },
    unknown
  >
  public response<TResponse>(
    status: 202
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    typeof emptyValidation,
    { 202: JsonResponseDescriptor<TResponse> },
    unknown
  >
  public response(
    status: 204
  ): RouteDef<
    TVersion,
    TMethod,
    TPath,
    typeof emptyValidation,
    { 204: EmptyResponseDescriptor },
    unknown
  >
  public response(status: ShorthandStatus = 200) {
    return this.responses(shorthandResponses(status))
  }
}
