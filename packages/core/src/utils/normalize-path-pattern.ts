import { pathShape } from '@t-rest/protocol'

/** @deprecated Use `pathShape` from `@t-rest/protocol`. */
export const normalizePathPattern = (path: string): string => pathShape(path)
