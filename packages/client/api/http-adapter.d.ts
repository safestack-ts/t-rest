import { DecodedBody, ResponseMap, HTTPMethod } from '@t-rest/core';

type RequestConfig = {
    headers?: Record<string, string | number | boolean>;
};

/** Response headers with lower-case keys. Headers sent multiple times, e.g. `set-cookie`, are arrays. */
type HTTPResponseHeaders = Record<string, string | string[] | undefined>;
type ResponseOfStatus<TResponses, TStatus extends keyof TResponses & number> = {
    data: DecodedBody<TResponses[TStatus], ArrayBuffer, undefined>;
    statusCode: TStatus;
    /**
     * Optional so that existing custom `HTTPAdapter` implementations keep working,
     * but they should return it. Always set by `AxiosHTTPAdapter`.
     */
    headers?: HTTPResponseHeaders;
};
/** Any response of any route, e.g. for helpers which handle every route. */
type AnyHTTPResponse = {
    data: any;
    statusCode: number;
    /**
     * Optional so that existing custom `HTTPAdapter` implementations keep working,
     * but they should return it. Always set by `AxiosHTTPAdapter`.
     */
    headers?: HTTPResponseHeaders;
};
/**
 * Discriminated union of the responses a route declares, by `statusCode`.
 * Unknown responses (`unknown`, `any` or `ResponseMap`) are `AnyHTTPResponse`.
 */
type HTTPResponse<TResponses> = unknown extends TResponses ? AnyHTTPResponse : number extends keyof TResponses ? AnyHTTPResponse : TResponses extends unknown ? {
    [TStatus in keyof TResponses & number]: ResponseOfStatus<TResponses, TStatus>;
}[keyof TResponses & number] : never;

/** How the body of a single request is encoded. */
type RequestBodyEncoding = 'json' | 'multipart';
interface HTTPAdapter<TRequestContext = {}> {
    /**
     * Resolves for the statuses declared in `responses` and rejects for all
     * others. `responses` holds the descriptors of the route of the request,
     * `isDeclaredStatus` and `decodeBody` implement the contract.
     *
     * `responses` follows `requestConfig`, so that an adapter written for an
     * earlier version keeps receiving its `requestConfig`.
     *
     * `bodyEncoding` is `'multipart'` when `data` is the `FormData` of a route
     * declared with `.multipart()`. It has to be sent as is, not serialized as
     * JSON: the transport sets the content type with its boundary.
     */
    request<TResponses extends ResponseMap>(method: HTTPMethod, url: string, data: unknown, requestConfig: (RequestConfig & TRequestContext) | undefined, responses: TResponses, bodyEncoding?: RequestBodyEncoding): Promise<HTTPResponse<TResponses>>;
}

export type { AnyHTTPResponse as A, HTTPAdapter as H, RequestConfig as R, RequestBodyEncoding as a, HTTPResponse as b, HTTPResponseHeaders as c };
