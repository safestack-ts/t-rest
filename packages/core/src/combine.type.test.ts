import { z } from "zod";
import { BagOfRoutes, ExtractRoutes, Route } from "./index";
import { combine } from "./combine";
import { AssertFalse, IsNever } from "conditional-type-checks";

type User = {
  id: string;
  email: string;
};

type Basket = {
  id: string;
  entries: any[];
  priceTotal: number;
};

const bagOfRoutesUsers = BagOfRoutes.withoutVersioning()
  .addRoute(new Route().get("/users").response<User[]>())
  .addRoute(new Route().post("/users").response<User>())
  .build();

const bagOfRoutesBaskets = BagOfRoutes.withoutVersioning()
  .addRoute(
    new Route()
      .get("/baskets/:basketId")
      .validate(z.object({ params: z.object({ basketId: z.string() }) }))
      .response<Basket>()
  )
  .addRoute(new Route().post("/baskets").response<Basket>())
  .build();

const bagOfRoutes = combine(bagOfRoutesUsers, bagOfRoutesBaskets);
type Routes = ExtractRoutes<typeof bagOfRoutes>;

// every route should be part of the combined bag
type GetUsersRoute = Extract<Routes, { method: "GET"; path: "/users" }>;
type PostUsersRoute = Extract<Routes, { method: "POST"; path: "/users" }>;
type GetBasketsRoute = Extract<
  Routes,
  { method: "GET"; path: "/baskets/:basketId" }
>;
type PostBasketsRoute = Extract<Routes, { method: "POST"; path: "/baskets" }>;

type _test =
  | AssertFalse<IsNever<GetUsersRoute>>
  | AssertFalse<IsNever<PostUsersRoute>>
  | AssertFalse<IsNever<GetBasketsRoute>>
  | AssertFalse<IsNever<PostBasketsRoute>>;
