import { BodyEncoding } from '../../types/body-encoding.js'
import {
  MultipartFileParts,
  MultipartOptions,
} from '../../types/multipart-options.js'
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
    private bodyEncoding?: TBodyEncoding,
    private multipartFiles?: MultipartFileParts
  ) {}

  /**
   * Declares that the route takes `multipart/form-data`. Parsing the upload
   * stays up to a route middleware, the validator describes its result.
   * GET and DELETE never send a body and are rejected.
   *
   * `json: true` keeps accepting the body as JSON too, `files` names the file
   * fields so OpenAPI documents them.
   */
  public multipart<const TOptions extends MultipartOptions = {}>(
    this: RouteBuilderWithVersionAndMethodAndPath<
      TVersion,
      TMethod & BodyMethod,
      TPath,
      TBodyEncoding
    >,
    options?: TOptions
  ) {
    type TMultipartEncoding = TOptions extends { json: true }
      ? 'json-or-multipart'
      : 'multipart'

    return new RouteBuilderWithVersionAndMethodAndPath<
      TVersion,
      TMethod,
      TPath,
      TMultipartEncoding
    >(
      this.version,
      this.method as TMethod,
      this.path,
      (options?.json ? 'json-or-multipart' : 'multipart') as TMultipartEncoding,
      options?.files
    )
  }

  public validate<TValidator>(validator: TValidator) {
    return new RouteBuilderWithVersionAndMethodAndPathAndValidator<
      TVersion,
      TMethod,
      TPath,
      TValidator,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      validator,
      this.bodyEncoding,
      this.multipartFiles
    )
  }

  public metaData<TMetaData>(metaData: TMetaData) {
    return new RouteBuilderWithVersionAndMethodAndPathAndMetaData<
      TVersion,
      TMethod,
      TPath,
      TMetaData,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      metaData,
      this.bodyEncoding,
      this.multipartFiles
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
      unknown,
      TBodyEncoding
    >(
      this.version,
      this.method,
      this.path,
      emptyValidation,
      responses,
      null,
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
    unknown,
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
    unknown,
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
    unknown,
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
    unknown,
    TBodyEncoding
  >
  public response(status: ShorthandStatus = 200) {
    return this.responses(shorthandResponses(status))
  }
}
