type RequestInputWithQuery = {
    query: unknown;
};
type RequestInputWithParams = {
    params: unknown;
};
type RequestInputWithBody = {
    body: unknown;
};
type BaseRequestInput = Partial<RequestInputWithQuery> & Partial<RequestInputWithParams> & Partial<RequestInputWithBody>;
/** Builds the request url from a path template, its params and the query. */
declare const buildUrl: (path: string, request?: BaseRequestInput) => string;

declare const HTTP_METHODS: readonly ["GET", "POST", "PUT", "PATCH", "DELETE"];
type HttpMethod = (typeof HTTP_METHODS)[number];
/** Requests with these methods never carry a body. */
declare const methodSendsBody: (method: HttpMethod) => boolean;

/** Names of the path params in positional order (`/a/:x/b/:y` -> `x`, `y`). */
declare const pathParamNames: (path: string) => string[];
/**
 * The version independent identity of a path: every param becomes `%s`, so
 * `/users/:id` and `/users/:userId` share one shape.
 */
declare const pathShape: (path: string) => string;
/**
 * Replaces every `:name` placeholder in `path` whose name is a key of `params`
 * with the URL-encoded param value. Placeholders are matched by their whole
 * name, so `:id` never matches inside `:idx`. Placeholders without a param
 * are left untouched.
 */
declare const fillPathParams: (path: string, params?: Record<string, unknown>) => string;
/**
 * Joins a prefix and a path to one absolute path: duplicate slashes are
 * collapsed (except in `://`) and the trailing slash is removed unless the
 * result is the root path.
 */
declare const joinPaths: (prefix: string, path: string) => string;

/**
 * Serializes a query object into a URL search string (without the leading `?`).
 *
 * - `undefined` and `null` values are omitted.
 * - Objects with a `toJSON` method (e.g. `Date`) are serialized via `toJSON()`,
 *   other objects and arrays as JSON strings (`ids=[1,2]`), which servers
 *   parse back with a JSON query validator (e.g. `ze.jsonObject`). An empty
 *   array is kept as `[]`.
 * - Everything else is serialized via `String(value)`.
 */
declare const encodeQuery: (query: unknown | undefined) => string;
/**
 * Inverse of the structured values of `encodeQuery`: parses a JSON string.
 * Returns the input unchanged if it is not a string or not valid JSON.
 */
declare const decodeStructuredQueryValue: (value: unknown) => unknown;

type PlannedBody = {
    send: false;
} | {
    send: true;
    value: unknown;
};
type RequestPlan = {
    url: string;
    body: PlannedBody;
};
/** The url and the body of a request, GET and DELETE never send a body. */
declare const planRequest: (method: HttpMethod, path: string, input?: BaseRequestInput) => RequestPlan;

type VersionConvention = {
    kind: 'header';
    name: string;
};
/** Declares that the api version travels in the header `name`. */
declare const versionHeader: (name: string) => VersionConvention;
type HeaderSource = Record<string, unknown> | ((name: string) => unknown);
/**
 * Reads the requested version. Headers are either an object (looked up by the
 * lower-cased header name, then by the name as declared) or a getter function.
 */
declare const readVersion: (convention: VersionConvention, headers: HeaderSource) => string | undefined;
/** Returns new headers with the version set, replacing any existing value of the header. */
declare const writeVersion: <THeaderValue>(convention: VersionConvention, headers: Record<string, THeaderValue>, version: string) => Record<string, THeaderValue | string>;

export { HTTP_METHODS, buildUrl, decodeStructuredQueryValue, encodeQuery, fillPathParams, joinPaths, methodSendsBody, pathParamNames, pathShape, planRequest, readVersion, versionHeader, writeVersion };
export type { BaseRequestInput, HttpMethod, PlannedBody, RequestPlan, VersionConvention };
