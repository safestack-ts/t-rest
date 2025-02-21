import { HTTPMethod } from '../../types/http-method'
import type { StandardSchemaV1 } from '@standard-schema/spec'

export class RouteDef<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TResponse,
  TMetaData
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

  constructor(
    version: TVersion,
    method: TMethod,
    path: TPath,
    validator: TValidator,
    metaData: TMetaData
  ) {
    this.version = version
    this.method = method
    this.path = path
    this.validator = validator
    this['~responseType'] = null as any
    this['~validatorOutputType'] = null as any
    this.metaData = metaData
  }
}
