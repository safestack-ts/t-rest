/**
 * How a route takes its body: `json`, `multipart/form-data`, or either of
 * them (`.multipart({ json: true })`), e.g. for integrators that keep sending
 * JSON to a route that also accepts uploads.
 */
export type BodyEncoding = 'json' | 'multipart' | 'json-or-multipart'
