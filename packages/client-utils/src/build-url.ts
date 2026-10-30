import {
  buildUrl as protocolBuildUrl,
  type BaseRequestInput as ProtocolBaseRequestInput,
} from '@t-rest/protocol'

/** @deprecated Use `BaseRequestInput` from `@t-rest/protocol`. */
export type BaseRequestInput = ProtocolBaseRequestInput

/** @deprecated Use `buildUrl` from `@t-rest/protocol`. */
export const buildUrl = protocolBuildUrl
