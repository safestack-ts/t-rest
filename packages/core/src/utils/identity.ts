import { AddReadonlyDeep } from '../types/add-readonly.js'
import { RemoveReadonlyDeep } from '../types/remove-readonly.js'

/** @deprecated Internal helper, will be removed from the public API in a future major. */
export const TypedIdentity =
  <Shape>() =>
  <const Value extends AddReadonlyDeep<Shape>>(
    value: Value
  ): RemoveReadonlyDeep<Value> =>
    value as RemoveReadonlyDeep<Value>

/** @deprecated Internal helper, will be removed from the public API in a future major. */
export const Identity = <const T>(value: T) => value
