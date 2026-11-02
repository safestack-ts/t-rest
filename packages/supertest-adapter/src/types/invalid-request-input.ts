import { BaseRequestInput } from '@t-rest/protocol'

/**
 * The input of a request that is meant to fail validation: `params`, `query`
 * and `body` are not tied to the validator of the route and may be left out.
 */
export type InvalidRequestInput = BaseRequestInput
