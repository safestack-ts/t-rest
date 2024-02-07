import {
  BagOfRoutes,
  Route,
  VersionHistory,
  Versioning,
  ze,
} from "@typed-rest/core";
import { User } from "./utils/test-entity-types";
import { z } from "zod";
import { TypedExpressApplication } from "..";
import Express from "express";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import { DateVersionExtractor } from "../version-extractor";

type ResponseWithVersion<T> = {
  data: T;
  version: string;
};

const versionHistory = VersionHistory([
  "2024-01-01",
  "2024-02-01",
  "2024-03-01",
] as const);

const baseBagOfRoutes = BagOfRoutes.withVersioning(
  Versioning.DATE,
  versionHistory
)
  .addRoute(
    new Route()
      .version("2024-01-01")
      .get("/users/:userId")
      .validate(z.object({ params: z.object({ userId: ze.parseInteger() }) }))
      .response<ResponseWithVersion<User>>()
  )
  .addRoute(
    new Route()
      .version("2024-02-01")
      .get("/users/:userId")
      .validate(z.object({ params: z.object({ userId: ze.uuid() }) }))
      .response<ResponseWithVersion<User>>()
  )
  .build();

class PricenowAPIVersionHeaderExtractor implements DateVersionExtractor {
  extractVersion(request: Express.Request) {
    return request.header("x-pricenow-api-version");
  }
  parseDate(version: string) {
    return new Date(version);
  }
}

const initApplication = (expressApp: Express.Application) => {
  const typedExpressApplication = TypedExpressApplication.withVersioning(
    expressApp,
    baseBagOfRoutes,
    versionHistory,
    new PricenowAPIVersionHeaderExtractor()
  );
  const userRouter = typedExpressApplication.branch("/users");

  userRouter
    .get("/:userId")
    .version("2024-01-01")
    .handle((_, { params: { userId } }) => ({
      statusCode: 200,
      data: {
        version: "2024-01-01",
        data: { id: userId, email: `user-${userId}@email.com` },
      },
    }));

  userRouter
    .get("/:userId")
    .version("2024-02-01")
    .handle((_, { params: { userId } }) => ({
      statusCode: 200,
      data: {
        version: "2024-02-01",
        data: { id: 42, email: `user-${userId}@email.com` },
      },
    }));

  return typedExpressApplication;
};

test("calling route without any version resolves to latest version", async () => {
  const expressApp = Express();
  initApplication(expressApp);

  const response = await request(expressApp)
    .get("/users/7487bdc6-f308-4852-ad06-07ff7fb7a349")
    .expect((res) =>
      !res.status.toString().startsWith("2") ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK);

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 42,
      email: `user-7487bdc6-f308-4852-ad06-07ff7fb7a349@email.com`,
    },
    version: "2024-02-01",
  });
});

test("calling route with newer version resolves to latest available version of the route", async () => {
  const expressApp = Express();
  initApplication(expressApp);

  const response = await request(expressApp)
    .get("/users/7487bdc6-f308-4852-ad06-07ff7fb7a349")
    .set("X-Pricenow-API-Version", "2024-03-01")
    .expect((res) =>
      !res.status.toString().startsWith("2") ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK);

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 42,
      email: `user-7487bdc6-f308-4852-ad06-07ff7fb7a349@email.com`,
    },
    version: "2024-02-01",
  });
});

test("calling route with outdated version resolves to outdated version of the route", async () => {
  const expressApp = Express();
  initApplication(expressApp);

  const response = await request(expressApp)
    .get("/users/1337")
    .set("X-Pricenow-API-Version", "2024-01-01")
    .expect((res) =>
      !res.status.toString().startsWith("2") ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK);

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 1337,
      email: `user-1337@email.com`,
    },
    version: "2024-01-01",
  });
});

test("calling route with version in between two history versions resolves to nearest lower version of the route", async () => {
  const expressApp = Express();
  initApplication(expressApp);

  const response = await request(expressApp)
    .get("/users/1337")
    .set("X-Pricenow-API-Version", "2024-01-15")
    .expect((res) =>
      !res.status.toString().startsWith("2") ? console.error(res.body) : 0
    )
    .expect(StatusCodes.OK);

  expect(response.body).toEqual<ResponseWithVersion<User>>({
    data: {
      id: 1337,
      email: `user-1337@email.com`,
    },
    version: "2024-01-01",
  });
});
