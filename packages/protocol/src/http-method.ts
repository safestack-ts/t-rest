export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

/** Requests with these methods never carry a body. */
export const methodSendsBody = (method: HttpMethod): boolean =>
  method !== 'GET' && method !== 'DELETE'
