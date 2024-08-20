export type HTTPResponse<TResponse> = {
  data: TResponse
  statusCode: number
  // @todo add more
}
