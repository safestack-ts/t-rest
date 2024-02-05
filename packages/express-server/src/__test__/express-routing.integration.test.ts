import { BagOfRoutes, Route, ze } from "@typed-rest/core";
import Express from "express";
import { z } from "zod";
import { TypedExpressApplication } from "../index";
import request from "supertest";
import { StatusCodes } from "http-status-codes";

type User = {
  id: number;
  name: string;
};

type BasketEntry = {
  id: string;
  productName: string;
  quantity: number;
};

type Basket = {
  id: string;
  entries: BasketEntry[];
};

const baseBagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(new Route().get("/users/me").response<User>())
  .addRoute(
    new Route()
      .get("/users/:userId")
      .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
      .response<User>()
  );

test("simple express app without versioning routing is working", async () => {
  const expressApp = Express();
  const bagOfRoutes = baseBagOfRoutes.build();
  const typedRESTApplication = new TypedExpressApplication(
    expressApp,
    bagOfRoutes
  );

  typedRESTApplication.get("/users/me").handle(() => ({
    statusCode: StatusCodes.OK,
    data: { id: 1, name: "John Doe" },
  }));

  typedRESTApplication
    .get("/users/:userId")
    .handle((_, { params: { userId } }) => ({
      statusCode: StatusCodes.OK,
      data: { id: userId, name: `User ${userId}` },
    }));

  const response = await request(expressApp)
    .get("/users/1")
    .expect(StatusCodes.OK);

  expect(response.body).toEqual<User>({ id: 1, name: "User 1" });
});

test("express app with multiple routers without versioning is working", async () => {
  const expressApp = Express();

  const bagOfRoutes = baseBagOfRoutes
    .addRoute(
      new Route()
        .get("/baskets/:basketId")
        .validate(z.object({ params: z.object({ basketId: z.string() }) }))
        .response<Basket>()
    )
    .addRoute(new Route().post("/baskets").response<Basket>())
    .build();

  const typedRESTApplication = new TypedExpressApplication(
    expressApp,
    bagOfRoutes
  );

  const userRouter = typedRESTApplication.branch("/users");
  userRouter.get("/me").handle(() => ({
    statusCode: StatusCodes.OK,
    data: { id: 1, name: "John Doe" },
  }));
  userRouter.get("/:userId").handle((_, { params: { userId } }) => ({
    statusCode: StatusCodes.OK,
    data: { id: userId, name: `User ${userId}` },
  }));

  const basketRouter = typedRESTApplication.branch("/baskets");

  basketRouter.get("/:basketId").handle((_, { params: { basketId } }) => ({
    statusCode: StatusCodes.OK,
    data: { id: basketId, entries: [] },
  }));

  basketRouter.post("/").handle(() => ({
    statusCode: StatusCodes.CREATED,
    data: { id: "123", entries: [] },
  }));

  const createUserResponse = await request(expressApp)
    .get("/users/1")
    .expect(StatusCodes.OK);

  expect(createUserResponse.body).toEqual<User>({ id: 1, name: "User 1" });

  const createBasketResponse = await request(expressApp)
    .post("/baskets")
    .expect(StatusCodes.CREATED);

  expect(createBasketResponse.body).toEqual<Basket>({
    id: "123",
    entries: [],
  });
});
