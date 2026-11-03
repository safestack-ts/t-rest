import { AxiosRequestConfig, AxiosInstance } from 'axios';
import { HTTPAdapter, RequestConfig, RequestBodyEncoding, HTTPResponse, HTTPResponseHeaders } from './index.js';
import { ResponseMap, HTTPMethod } from '@t-rest/core';

declare class AxiosHTTPAdapter implements HTTPAdapter<AxiosRequestConfig> {
    private readonly axiosInstance;
    constructor(axiosInstance: AxiosInstance);
    request<TResponses extends ResponseMap>(method: HTTPMethod, url: string, data: unknown, requestConfig: (RequestConfig & AxiosRequestConfig) | undefined, responses: TResponses, bodyEncoding?: RequestBodyEncoding): Promise<HTTPResponse<TResponses> & {
        headers: HTTPResponseHeaders;
    }>;
}

export { AxiosHTTPAdapter };
