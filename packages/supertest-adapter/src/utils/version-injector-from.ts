import { writeVersion, type VersionConvention } from '@t-rest/protocol'
import { SupertestVersionInjector } from '../classes/version-injector.js'

// writes the version into the request the way the server reads it
export const versionInjectorFrom = (
  convention: VersionConvention
): SupertestVersionInjector =>
  new (class extends SupertestVersionInjector {
    public modifyHeaders(
      headers: Record<string, string | number | boolean>,
      version: string
    ) {
      return writeVersion(convention, headers, version)
    }
  })()
