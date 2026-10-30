import { writeVersion, type VersionConvention } from '@t-rest/protocol'
import {
  VersionInjector,
  VersionInjectorConstructor,
} from '../classes/version-injector.js'

// writes the version into the request the way the server reads it
export const versionInjectorFrom = (
  convention: VersionConvention
): VersionInjectorConstructor =>
  class extends VersionInjector {
    public modifyHeaders(headers: Record<string, string | number | boolean>) {
      return writeVersion(convention, headers, this.version)
    }
  }
