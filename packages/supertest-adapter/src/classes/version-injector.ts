export abstract class SupertestVersionInjector {
  public modifyUrl(url: string, _version: string) {
    return url
  }

  public modifyHeaders(
    headers: Record<string, string | number | boolean>,
    _version: string
  ) {
    return headers
  }
}

/** @deprecated Renamed to `SupertestVersionInjector`, the client has a `VersionInjector` of its own. */
export const VersionInjector = SupertestVersionInjector

/** @deprecated Renamed to `SupertestVersionInjector`, the client has a `VersionInjector` of its own. */
export type VersionInjector = SupertestVersionInjector
