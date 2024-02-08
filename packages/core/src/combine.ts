import { AnyRouteDef, BagOfRoutes, HashMap, Versioning } from ".";
import { NonEmptyArray, first } from "./non-empty-array";

export type CombinedBags<
  TRoutes extends AnyRouteDef,
  TBags extends BagOfRoutes<any, Versioning>[]
> = TBags extends [
  BagOfRoutes<infer TRoute, Versioning>,
  ...infer TRemainingClients
]
  ? TRemainingClients extends BagOfRoutes<any, Versioning>[]
    ? CombinedBags<TRoutes | TRoute, TRemainingClients>
    : TRoutes
  : TRoutes;

export const combine = <
  TVersioning extends Versioning,
  TBags extends NonEmptyArray<BagOfRoutes<AnyRouteDef, TVersioning>>
>(
  ...bags: TBags
): BagOfRoutes<CombinedBags<never, TBags>, TVersioning> =>
  new BagOfRoutes<CombinedBags<never, TBags>, TVersioning>(
    new HashMap(
      (key) => key.join("-"),
      bags.flatMap((bag) => Array.from(bag.routes.entries()))
    ),
    first(bags).versioning
  );
