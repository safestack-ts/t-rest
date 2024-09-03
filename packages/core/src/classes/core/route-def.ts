import { HTTPMethod } from '../../types/http-method'
import { _responseType } from '../../symbols/response-type'
import { AnyRouteValidator } from '../../types/any-route-validator'

export class RouteDef<
  TVersion extends string,
  TMethod extends HTTPMethod,
  TPath extends string,
  TValidator extends AnyRouteValidator,
  TResponse,
  TMetaData
> {
  public readonly version: TVersion
  public readonly method: TMethod
  public readonly path: TPath
  public readonly validator: TValidator
  public readonly [_responseType]: TResponse
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
    this[_responseType] = null as any
    this.metaData = metaData
  }
}
