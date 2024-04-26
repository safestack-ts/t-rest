import { AnyRouteDef, RouteDef } from "@typed-rest/core";
import { z } from "zod";

export type RouteValidationOutput<TRoute extends AnyRouteDef> =
  TRoute extends RouteDef<any, any, any, infer TValidator, any, any>
    ? z.output<TValidator>
    : never;
