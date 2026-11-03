import { BodyEncoding } from '../../types/body-encoding.js'
import { MultipartFileParts } from '../../types/multipart-options.js'
import { HTTPMethod } from '../../types/http-method.js'
import { RouteDef } from '../core/route-def.js'
import {
  EmptyResponseDescriptor,
  Examples,
  JsonResponseDescriptor,
  StrictResponseMap,
} from '../../types/response-descriptor.js'
import {
  shorthandResponses,
  ShorthandStatus,
} from '../../internal/response-shorthand.js'
import { CheckMeta } from '../../types/route-meta.js'
import { RouteBuilderWithVersionAndMethodAndPathAndValidatorAndMetaData } from './route-builder-with-version-and-method-and-path-and-validator-and-meta-data.js'

export class RouteBuilderWithVersionAndMethodAndPathAndValidator<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TBodyEncoding extends BodyEncoding = 'json'
> {
  constructor(
    private version: TVersion,
    private method: TMethod,
    private path: TPath,
    private validator: TValidator,
    private bodyEncoding?: TBodyEncoding,
    private multipartFiles?: MultipartFileParts,
    private requestExamples?: Examples<unknown>
  ) {}

  public metaData<TMetaData extends CheckMeta<TMetaData>>(metaData: TMetaData) {
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
      this.validator,
      metaData,
      this.bodyEncoding,
      this.multipartFiles,
      this.requestExamples
    )
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
      unknown,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      this.validator,
      responses,
      null,
      this.bodyEncoding,
      this.multipartFiles,
      this.requestExamples
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
    unknown,
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
    unknown,
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
    unknown,
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
    unknown,
    TBodyEncoding
  >
  public response(status: ShorthandStatus = 200) {
    return this.responses(shorthandResponses(status))
  }
}
