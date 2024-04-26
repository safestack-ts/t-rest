import { RouteBuilderWithVersionAndMethodAndPath } from '../route-builder/route-builder-with-version-and-method-and-path'

export class RouteWithVersion<TVersion extends string> {
  constructor(private version: TVersion) {}

  public get<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      'GET',
      path
    )
  }

  public post<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      'POST',
      path
    )
  }

  public put<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      'PUT',
      path
    )
  }

  public patch<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      'PATCH',
      path
    )
  }

  public delete<TPath extends string>(path: TPath) {
    return new RouteBuilderWithVersionAndMethodAndPath(
      this.version,
      'DELETE',
      path
    )
  }
}
