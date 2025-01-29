import {
  HashMap,
  HTTPMethod,
  Versioning,
  AnyRouteDef,
  typedLowerCase,
} from '@t-rest/core'
import { StatusCodes } from 'http-status-codes'
import { AnyRouteHandlerFn } from '../types/any-route-handler-fn'
import {
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts'
import { RouteBundle } from '../types/route-bundle'
import { TypedMiddleware } from '../types/typed-middleware'
import { VersionExtractor } from '../types/version-extractor'
import { isDateVersionExtractor } from '../utils/is-date-version-extractor'
import { removePrefixFromPath } from '../utils/remove-prefix-from-path'
import { resolveDateVersion, resolveVersion } from '../utils/resolve-version'
import { TypedRouterBase } from './typed-router-base'

export class VersionedRouting {
  // mapping http method and path to potential multiple route versions
  protected readonly routes: HashMap<[HTTPMethod, string], RouteBundle[]> =
    new HashMap((key) => key.join('-'))
  protected readonly router: TypedRouterBase<any, any, string, string[]>
  protected readonly versionHistory: string[]
  protected readonly versioning: Versioning
  protected readonly versionExtractor: VersionExtractor

  constructor(
    router: TypedRouterBase<any, any, string, string[]>,
    versioning: Versioning,
    versionHistory: string[],
    versionExtractor: VersionExtractor
  ) {
    this.router = router
    this.versioning = versioning
    this.versionHistory = versionHistory
    this.versionExtractor = versionExtractor
  }

  public addRoute(
    route: AnyRouteDef,
    handler: AnyRouteHandlerFn,
    middlewares: TypedMiddleware<any, any>[]
  ) {
    const key = [route.method, route.path] as [HTTPMethod, string]

    if (this.routes.has(key)) {
      this.routes.get(key)!.push({ route, handler, middlewares })
    } else {
      this.routes.set(key, [{ route, handler, middlewares }])

      this.initRouting(route)
    }
  }

  private initRouting(route: AnyRouteDef) {
    const moutingPath = removePrefixFromPath(route.path, this.router.fullPath)

    this.router.expressRouter[typedLowerCase(route.method)](
      moutingPath,
      this.getRouteHandler(route.method, route.path)
    )
  }

  private getRouteHandler(method: HTTPMethod, path: string) {
    return async (request: ExpressRequest, response: ExpressResponse) => {
      try {
        const { routeToExecute, version } = this.getRouteToExecute(
          method,
          path,
          this.versionExtractor.extractVersion(request) ??
            this.versionHistory.at(-1)
        )

        const { middlewares, handler, route } = routeToExecute

        // emulate express behavior for executing middlewares
        let i = 0
        const nextMiddleware = async () => {
          const middleware = middlewares.at(i++)

          if (middleware) {
            await middleware(request, response, nextMiddleware)
          } else {
            const validationOutput = route.validator.parse(request)

            await handler(
              { ...request, version } as any as ExpressRequest,
              validationOutput,
              response
            )
          }
        }
        await nextMiddleware()
      } catch (err) {
        const error = err as Error

        response.status(StatusCodes.BAD_REQUEST).json({ error: error.message })
      }
    }
  }

  protected getRouteToExecute(
    method: HTTPMethod,
    path: string,
    requestedVersion: string | undefined
  ) {
    const key = [method, path] as [HTTPMethod, string]
    const routes = this.routes.get(key)

    if (!routes) {
      throw new Error(`No route handler found for method ${method} ${path}`)
    }

    if (this.versioning === Versioning.NO_VERSIONING) {
      const firstRoute = routes.at(0)

      if (!firstRoute) {
        throw new Error(`No route handler found for method ${method} ${path}`)
      }

      return { routeToExecute: firstRoute, version: null }
    } else {
      if (!requestedVersion) {
        throw new Error('No version specified and no default version found')
      }

      const resolvedVersion = isDateVersionExtractor(this.versionExtractor)
        ? resolveDateVersion(
            this.versionHistory,
            routes.map(({ route }) => route.version),
            requestedVersion,
            this.versionExtractor
          )
        : resolveVersion(
            this.versionHistory,
            routes.map(({ route }) => route.version),
            requestedVersion
          )

      if (resolvedVersion === null) {
        throw new Error(
          `No compatible route version found for requested version ${requestedVersion}`
        )
      }

      const routeToExecute = routes.find(
        ({ route }) => route.version === resolvedVersion
      )

      if (routeToExecute === undefined) {
        throw new Error(
          `No executable route version found for resolved version ${resolvedVersion}`
        )
      }

      return {
        routeToExecute,
        version: { requested: requestedVersion, resolved: resolvedVersion },
      }
    }
  }
}
