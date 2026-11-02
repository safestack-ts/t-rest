import { ResponseMap } from '../types/response-descriptor.js'
import { empty, json } from '../utils/response-descriptors.js'

/** The statuses `.response()` accepts, `204` declares an empty body. */
export type ShorthandStatus = 200 | 201 | 202 | 204

export const shorthandResponses = (status: ShorthandStatus): ResponseMap => ({
  [status]: status === 204 ? empty() : json(),
})
