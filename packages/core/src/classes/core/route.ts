import { RouteBuilderWithVersionAndMethodAndPath } from '../route-builder/route-builder-with-version-and-method-and-path'
import { RouteWithVersion } from './route-with-version'

export class Route {
  public version<TVersion extends string>(version: TVersion) {
    return new RouteWithVersion(version)
  }

  public get<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'GET', path)
  }

  public post<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'POST', path)
  }

  public put<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'PUT', path)
  }

  public patch<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'PATCH', path)
  }

  public delete<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath('', 'DELETE', path)
  }
}
