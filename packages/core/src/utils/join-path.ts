import { joinPaths } from '@t-rest/protocol'

/** @deprecated Use `joinPaths` from `@t-rest/protocol`. */
export const joinPath = (prefix: string, path: string): string =>
  joinPaths(prefix, path)
