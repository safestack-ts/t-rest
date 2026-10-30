import { BodyEncoding } from '../../types/body-encoding.js'
import { HTTPMethod } from '../../types/http-method.js'
import type { StandardSchemaV1 } from '@standard-schema/spec'

export class RouteDef<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TResponse,
  TMetaData,
  TBodyEncoding extends BodyEncoding = BodyEncoding
> {
  public readonly version: TVersion
  public readonly method: TMethod
  public readonly path: TPath
  public readonly validator: TValidator
  public readonly ['~responseType']: TResponse
  public readonly ['~validatorOutputType']: TValidator extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<TValidator>
    : never
  public readonly metaData: TMetaData
  public readonly bodyEncoding: TBodyEncoding

  constructor(
    version: TVersion,
    method: TMethod,
    path: TPath,
    validator: TValidator,
    metaData: TMetaData,
    bodyEncoding: TBodyEncoding = 'json' as TBodyEncoding
  ) {
    this.version = version
    this.method = method
    this.path = path
    this.validator = validator
    this['~responseType'] = null as any
    this['~validatorOutputType'] = null as any
    this.metaData = metaData
    this.bodyEncoding = bodyEncoding
  }
}
