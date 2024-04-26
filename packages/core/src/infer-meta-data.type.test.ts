import { z } from "zod";
import { BagOfRoutes, Route } from ".";
import { ExtractRoutes } from "./extract-route";
import { AssertTrue, IsExact } from "conditional-type-checks";

const unversionedBagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    new Route()
      .get("/users")
      .metaData({ description: "Get all users" })
      .response<void>()
  )
  .addRoute(
    new Route()
      .post("/users")
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .metaData({ description: "Create a user" })
      .response<void>()
  )
  .build();

type UnversionedRoutes = ExtractRoutes<typeof unversionedBagOfRoutes>;

type UnversionedGetUsersRoute = Extract<
  UnversionedRoutes,
  { method: "GET"; path: "/users" }
>;
type UnversionedGetUsersRouteMetaData = UnversionedGetUsersRoute["metaData"];

type UnversionedPostUsersRoute = Extract<
  UnversionedRoutes,
  { method: "POST"; path: "/users" }
>;
type UnversionedPostUsersRouteMetaData = UnversionedPostUsersRoute["metaData"];

type _test =
  | AssertTrue<
      IsExact<UnversionedGetUsersRouteMetaData, { description: string }>
    >
  | AssertTrue<
      IsExact<UnversionedPostUsersRouteMetaData, { description: string }>
    >;
