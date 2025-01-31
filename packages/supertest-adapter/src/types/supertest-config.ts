export type SupertestConfig = {
  headers?: Record<string, string>
  expect?: {
    headers?: Record<string, RegExp>
    status?: number
  }
}
