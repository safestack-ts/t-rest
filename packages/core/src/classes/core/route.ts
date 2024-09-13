import { RouteBuilderWithVersionAndMethodAndPath } from '../route-builder/route-builder-with-version-and-method-and-path'
import { RouteWithVersion } from './route-with-version'

export abstract class Route {
  public static version<TVersion extends string>(version: TVersion) {
    return new RouteWithVersion(version)
  }

  public static get<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'GET', path)
  }

  public static post<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'POST', path)
  }

  public static put<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'PUT', path)
  }

  public static patch<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'PATCH', path)
  }

  public static delete<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'DELETE', path)
  }
}
