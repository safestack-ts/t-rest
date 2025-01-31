export abstract class VersionInjector {
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
