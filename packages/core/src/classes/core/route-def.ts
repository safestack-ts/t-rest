import { BodyEncoding } from '../../types/body-encoding.js'
import { MultipartFileParts } from '../../types/multipart-options.js'
import { HTTPMethod } from '../../types/http-method.js'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { StrictResponseMap } from '../../types/response-descriptor.js'

export class RouteDef<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TResponses extends StrictResponseMap<TResponses>,
  TMetaData,
  // a hand-written annotation without it describes a json route
  TBodyEncoding extends BodyEncoding = 'json'
> {
  public readonly version: TVersion
  public readonly method: TMethod
  public readonly path: TPath
  public readonly validator: TValidator
  public readonly responses: TResponses
  public readonly ['~responses']: TResponses
  public readonly ['~validatorOutputType']: TValidator extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TValidator>
    : never
  public readonly metaData: TMetaData
  public readonly bodyEncoding: TBodyEncoding
  public readonly multipartFiles: MultipartFileParts | undefined

  constructor(
    version: TVersion,
    method: TMethod,
    path: TPath,
    validator: TValidator,
    responses: TResponses,
    metaData: TMetaData,
    bodyEncoding: TBodyEncoding = 'json' as TBodyEncoding,
    multipartFiles?: MultipartFileParts
  ) {
    this.version = version
    this.method = method
    this.path = path
    this.validator = validator
    this.responses = responses
    this['~responses'] = null as any
    this['~validatorOutputType'] = null as any
    this.metaData = metaData
    this.bodyEncoding = bodyEncoding
    this.multipartFiles = multipartFiles
  }
}
