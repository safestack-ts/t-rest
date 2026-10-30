import {
  Versioning,
  AnyRouteDef,
  typedLowerCase,
  ValidationError,
} from '@t-rest/core'
import {
  policyFrom,
  resolveRequest,
  VersionPolicy,
} from '../internal/version-policy.js'
import { VersionRegistry } from '../internal/version-registry.js'
import { AnyRouteHandlerFn } from '../types/any-route-handler-fn.js'
import {
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
} from '../types/express-type-shortcuts.js'
import { TypedMiddleware } from '../types/typed-middleware.js'
import { VersionExtractor } from '../types/version-extractor.js'
import { removePrefixFromPath } from '../utils/remove-prefix-from-path.js'
import { RouteSetupError } from './route-setup-error.js'
import { TypedRouterBase } from './typed-router-base.js'
import { VersionResolutionError } from './version-resolution-error.js'

export class VersionedRouting {
  protected readonly router: TypedRouterBase<any, any, string, string[]>
  protected readonly versionHistory: string[]
  protected readonly versioning: Versioning
  protected readonly versionExtractor: VersionExtractor
  protected readonly versionRegistry: VersionRegistry
  private readonly policy: VersionPolicy

  constructor(
    router: TypedRouterBase<any, any, string, string[]>,
    versioning: Versioning,
    versionHistory: string[],
    versionExtractor: VersionExtractor,
    versionRegistry: VersionRegistry = new VersionRegistry()
  ) {
    this.router = router
    this.versioning = versioning
    this.versionHistory = versionHistory
    this.versionExtractor = versionExtractor
    this.versionRegistry = versionRegistry
    this.policy = policyFrom(versioning, versionHistory, versionExtractor)
  }

  // registers an express route for this version of the route, so that express
  // fills the params with the names of this version and the middlewares of the
  // router are executed in the order in which they have been registered
  public addRoute(
    route: AnyRouteDef,
    handler: AnyRouteHandlerFn,
    middlewares: TypedMiddleware<any, any>[]
  ) {
    if (
      !this.versionRegistry.register(route.method, route.path, route.version)
    ) {
      throw new RouteSetupError(
        route.version === ''
          ? `Route ${route.method} ${route.path} is already handled`
          : `Route ${route.method} ${route.path} version ${route.version} is already handled`
      )
    }

    this.router.expressRouter[typedLowerCase(route.method)](
      removePrefixFromPath(route.path, this.router.fullPath),
      this.getRouteHandler(route, handler, middlewares)
    )
  }

  private getRouteHandler(
    route: AnyRouteDef,
    handler: AnyRouteHandlerFn,
    middlewares: TypedMiddleware<any, any>[]
  ) {
    const key = VersionRegistry.keyOf(route.method, route.path)

    return async (
      request: ExpressRequest,
      response: ExpressResponse,
      next: ExpressNextFunction
    ) => {
      try {
        const resolution = this.versionRegistry.resolve(request, key, () =>
          resolveRequest(
            this.policy,
            // treat an empty version (e.g. empty header) like a missing version
            this.versionExtractor.extractVersion(request) ||
              this.versionHistory.at(-1),
            this.versionRegistry.handledVersions(key)
          )
        )

        if (resolution.kind === 'missing') {
          throw new VersionResolutionError(
            'No version specified and no default version found'
          )
        }

        if (resolution.kind === 'incompatible') {
          throw new VersionResolutionError(
            `No compatible route version found for requested version ${resolution.requested}`
          )
        }

        if (
          resolution.kind === 'resolved' &&
          resolution.resolved !== route.version
        ) {
          // the route of the resolved version is up next, it might be
          // registered later or on a branch
          return next()
        }

        const version =
          resolution.kind === 'resolved'
            ? { requested: resolution.requested, resolved: resolution.resolved }
            : null

        // emulate express behavior for executing middlewares
        let i = 0
        const nextMiddleware = async (error?: unknown) => {
          if (error) {
            // abort middleware chain and call original next middleware with error
            return next(error)
          }

          try {
            const middleware = middlewares.at(i++)

            if (middleware) {
              await middleware(request, response, nextMiddleware)
            } else {
              const requestWithVersion = Object.create(request)

              const validationOutput = await route.validator[
                '~standard'
              ].validate(requestWithVersion)

              if (validationOutput.issues) {
                throw new ValidationError(validationOutput.issues)
              }

              requestWithVersion.version = version

              await handler(
                requestWithVersion,
                validationOutput.value,
                response
              )
            }
          } catch (err) {
            return next(err)
          }
        }
        await nextMiddleware()
      } catch (err) {
        return next(err)
      }
    }
  }
}
