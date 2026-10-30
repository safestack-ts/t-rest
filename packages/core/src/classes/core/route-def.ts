import { HTTPMethod } from '../../types/http-method.js'
import type { StandardSchemaV1 } from '@standard-schema/spec'

export class RouteDef<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator,
  TResponses,
  TMetaData
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

  constructor(
    version: TVersion,
    method: TMethod,
    path: TPath,
    validator: TValidator,
    responses: TResponses,
    metaData: TMetaData
  ) {
    this.version = version
    this.method = method
    this.path = path
    this.validator = validator
    this.responses = responses
    this['~responses'] = null as any
    this['~validatorOutputType'] = null as any
    this.metaData = metaData
  }
}
