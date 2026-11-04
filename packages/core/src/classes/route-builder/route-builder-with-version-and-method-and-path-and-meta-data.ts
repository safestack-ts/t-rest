import { BodyEncoding } from '../../types/body-encoding.js'
import { MultipartFileParts } from '../../types/multipart-options.js'
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
import { emptyValidation } from '../../utils/empty-validation.js'
import { ValidateOptions } from '../../types/validate-options.js'

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
    private bodyEncoding?: TBodyEncoding,
    private multipartFiles?: MultipartFileParts
  ) {}

  public validate<TValidator>(
    validator: TValidator,
    options?: ValidateOptions<TValidator>
  ) {
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
      this.bodyEncoding,
      this.multipartFiles,
      options?.examples
    )
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
      TMetaData,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      emptyValidation,
      responses,
      this.metaData,
      this.bodyEncoding,
      this.multipartFiles
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
    typeof emptyValidation,
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
    typeof emptyValidation,
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
    typeof emptyValidation,
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
    typeof emptyValidation,
    { 204: EmptyResponseDescriptor },
    TMetaData,
    TBodyEncoding
  >
  public response(status: ShorthandStatus = 200) {
    return this.responses(shorthandResponses(status))
  }
}
