export abstract class VersionInjector {
  protected readonly version: string

  constructor(version: string) {
    this.version = version
  }

  public modifyUrl(url: string) {
    return url
  }

  public modifyHeaders(headers: Record<string, string | number | boolean>) {
    return headers
  }
}

export class NoVersionInjector extends VersionInjector {
  constructor(_version: string) {
    super(_version)
  }
}

export type VersionInjectorConstructor = new (
  version: string
) => VersionInjector
