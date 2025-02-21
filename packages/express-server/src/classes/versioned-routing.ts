import {
  HashMap,
  HTTPMethod,
  Versioning,
  AnyRouteDef,
  typedLowerCase,
  resolveDateVersion,
  resolveVersion,
  ValidationError,
} from '@t-rest/core'
import { AnyRouteHandlerFn } from '../types/any-route-handler-fn'
import {
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts'
import { ParamAlias, RouteBundle } from '../types/route-bundle'
import { TypedMiddleware } from '../types/typed-middleware'
import { VersionExtractor } from '../types/version-extractor'
import { isDateVersionExtractor } from '../utils/is-date-version-extractor'
import { removePrefixFromPath } from '../utils/remove-prefix-from-path'
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
    const key = [route.method, this.getNormalizedPathPattern(route.path)] as [
      HTTPMethod,
      string
    ]

    if (this.routes.has(key)) {
      const currentRoutes = this.routes.get(key)!
      this.routes.set(
        key,
        this.getRoutesWithPathParamAliases([
          ...currentRoutes,
          { route, handler, middlewares, paramAliases: [] },
        ])
      )
    } else {
      this.routes.set(key, [{ route, handler, middlewares, paramAliases: [] }])

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
      const { routeToExecute, version } = this.getRouteToExecute(
        method,
        path,
        this.versionExtractor.extractVersion(request) ??
          this.versionHistory.at(-1)
      )

      const { middlewares, handler, route, paramAliases } = routeToExecute

      // emulate express behavior for executing middlewares
      let i = 0
      const nextMiddleware = async () => {
        const middleware = middlewares.at(i++)

        if (middleware) {
          await middleware(request, response, nextMiddleware)
        } else {
          const requestWithParamAliases = this.getRequestWithParamAliases(
            request,
            paramAliases
          )

          const validationOutput = await route.validator['~standard'].validate(
            requestWithParamAliases
          )

          if (validationOutput.issues) {
            throw new ValidationError(validationOutput.issues)
          }

          ;(requestWithParamAliases as any).version = version

          await handler(
            requestWithParamAliases,
            validationOutput.value,
            response
          )
        }
      }
      await nextMiddleware()
    }
  }

  protected getRouteToExecute(
    method: HTTPMethod,
    path: string,
    requestedVersion: string | undefined
  ) {
    const key = [method, this.getNormalizedPathPattern(path)] as [
      HTTPMethod,
      string
    ]
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
            this.versionExtractor.parseDate
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

  protected getNormalizedPathPattern(path: string): string {
    // Replace Express-style params (:paramName) with %s
    return path.replace(/:[a-zA-Z0-9]+/g, '%s')
  }

  protected getRoutesWithPathParamAliases(
    routes: RouteBundle[]
  ): RouteBundle[] {
    const routesSortedByVersion = this.getRoutesSortedByVersion(routes)

    return routesSortedByVersion.map((route) => {
      const firstRoute = routesSortedByVersion[0]
      const currentParams = route.route.path.match(/:[a-zA-Z0-9]+/g) || []
      const firstRouteParams =
        firstRoute.route.path.match(/:[a-zA-Z0-9]+/g) || []

      const paramAliases = currentParams.reduce((aliases, param, index) => {
        if (param !== firstRouteParams[index]) {
          aliases.push({
            oldName: firstRouteParams[index].replace(':', ''),
            newName: param.replace(':', ''),
            since: route.route.version,
          })
        }
        return aliases
      }, [] as ParamAlias[])

      return {
        ...route,
        paramAliases,
      }
    })
  }

  protected getRequestWithParamAliases(
    request: ExpressRequest,
    paramAliases: ParamAlias[]
  ): ExpressRequest {
    const newRequest = Object.create(request)
    newRequest.params = { ...request.params }

    paramAliases.forEach((alias) => {
      newRequest.params[alias.newName] = request.params[alias.oldName]
      delete newRequest.params[alias.oldName]
    })

    return newRequest
  }

  protected getRoutesSortedByVersion(routes: RouteBundle[]): RouteBundle[] {
    return routes.sort((a, b) => {
      const versionA = a.route.version
      const versionB = b.route.version

      if (isDateVersionExtractor(this.versionExtractor)) {
        // Check if versions are dates using this.versionExtractor.parseDate
        const dateA = this.versionExtractor.parseDate(versionA)
        const dateB = this.versionExtractor.parseDate(versionB)

        if (dateA && dateB) {
          return dateA.getTime() - dateB.getTime()
        }
      }

      // Check if versions are semver
      const semverRegex = /^\d+\.\d+\.\d+$/
      const isSemverA = semverRegex.test(versionA)
      const isSemverB = semverRegex.test(versionB)

      if (isSemverA && isSemverB) {
        return versionA.localeCompare(versionB, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      }

      // Fallback to simple string comparison for no versioning or other cases
      return versionA.localeCompare(versionB)
    })
  }
}
