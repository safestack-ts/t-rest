import { ExtractVersionMatchingRoute, HTTPMethod } from '@t-rest/core'
import {
  ApplicationRoutes,
  TypedExpressApplicationWithVersioning,
} from '@t-rest/express-server'

type AppVersionHistory<TApp> =
  TApp extends TypedExpressApplicationWithVersioning<
    any,
    any,
    any,
    infer THistory
  >
    ? THistory extends string[]
      ? THistory
      : never
    : never

type AppRoutesFor<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
> = Extract<ApplicationRoutes<TApp>, { method: TMethod; path: TPath }>

// the history versions the server resolves to a declared version of the route
type ResolvableVersions<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
> = {
  [TVersion in AppVersionHistory<TApp>[number]]: [
    ExtractVersionMatchingRoute<
      AppRoutesFor<TApp, TMethod, TPath>,
      TVersion,
      AppVersionHistory<TApp>
    >
  ] extends [never]
    ? never
    : TVersion
}[AppVersionHistory<TApp>[number]]

/**
 * The versions a request to the route may be sent with: the declared versions
 * of the route and the later versions of the history, which the server
 * resolves down to a declared version.
 *
 * The declared versions are part of the union explicitly, so that a version
 * history which is not a tuple (a plain `string[]`) keeps them callable.
 */
export type CallableVersions<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
> =
  | AppRoutesFor<TApp, TMethod, TPath>['version']
  | ResolvableVersions<TApp, TMethod, TPath>

/**
 * The route the server executes for the version of a request: the route
 * declared for exactly this version, else the newest route of an older version.
 */
export type AppRouteAt<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string
> = [
  Extract<AppRoutesFor<TApp, TMethod, TPath>, { version: TVersion }>
] extends [never]
  ? ExtractVersionMatchingRoute<
      AppRoutesFor<TApp, TMethod, TPath>,
      TVersion,
      AppVersionHistory<TApp>
    >
  : Extract<AppRoutesFor<TApp, TMethod, TPath>, { version: TVersion }>
