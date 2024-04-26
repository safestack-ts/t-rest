import { AddReadonlyDeep } from "../types/add-readonly";
import { RemoveReadonlyDeep } from "../types/remove-readonly";

export const TypedIdentity =
  <Shape>() =>
  <const Value extends AddReadonlyDeep<Shape>>(
    value: Value
  ): RemoveReadonlyDeep<Value> =>
    value as RemoveReadonlyDeep<Value>;

export const Identity = <const T>(value: T) => value;
