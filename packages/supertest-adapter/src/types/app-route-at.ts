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

type DropParamName<TRest extends string> =
  TRest extends `${string}/${infer TTail}` ? `/${TTail}` : ''

// type level `pathShape` of @t-rest/protocol: `/users/:id` -> `/users/%s`
type PathShape<TPath extends string> =
  TPath extends `${infer THead}:${infer TRest}`
    ? `${THead}%s${PathShape<DropParamName<TRest>>}`
    : TPath

// the routes the server resolves a request to the path against: all routes of
// the method whose template has the same shape, e.g. `/users/:id` and
// `/users/:userId`
type AppRoutesOfShape<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
> = Extract<ApplicationRoutes<TApp>, { method: TMethod }> extends infer TRoute
  ? TRoute extends { path: string }
    ? PathShape<TRoute['path']> extends PathShape<TPath>
      ? TRoute
      : never
    : never
  : never

// the route the server executes for a single version of the history
type ResolvedRoute<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string
> = ExtractVersionMatchingRoute<
  AppRoutesOfShape<TApp, TMethod, TPath>,
  TVersion,
  AppVersionHistory<TApp>
>

// the history versions the server resolves to a declared version of the route,
// leaving out versions that resolve to a newer template of the same shape
type ResolvableVersions<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string
> = {
  [TVersion in AppVersionHistory<TApp>[number]]: [
    ResolvedRoute<TApp, TMethod, TPath, TVersion>
  ] extends [never]
    ? never
    : ResolvedRoute<TApp, TMethod, TPath, TVersion> extends { path: TPath }
    ? TVersion
    : never
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
 * A union of versions yields the routes of all its members.
 */
export type AppRouteAt<
  TApp extends TypedExpressApplicationWithVersioning<any, any, any, any>,
  TMethod extends HTTPMethod,
  TPath extends string,
  TVersion extends string
> = TVersion extends string
  ? [
      Extract<AppRoutesFor<TApp, TMethod, TPath>, { version: TVersion }>
    ] extends [never]
    ? ResolvedRoute<TApp, TMethod, TPath, TVersion>
    : Extract<AppRoutesFor<TApp, TMethod, TPath>, { version: TVersion }>
  : never
