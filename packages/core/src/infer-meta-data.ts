import { AnyRouteDef, RouteDef } from ".";

export type InferMetaData<T extends AnyRouteDef> = T extends RouteDef<
  any,
  any,
  any,
  any,
  any,
  infer TMetaData
>
  ? TMetaData
  : never;
