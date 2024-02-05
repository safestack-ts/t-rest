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

test("simple express app without versioning routing is working", async () => {
  const expressApp = Express();
  const bagOfRoutes = BagOfRoutes.withoutVersioning()
    .addRoute(new Route().get("/users/me").response<User>())
    .addRoute(
      new Route()
        .get("/users/:userId")
        .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
        .response<User>()
    )
    .build();
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
