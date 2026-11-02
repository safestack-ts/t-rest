import {
  BinaryResponseDescriptor,
  DeclaredStatus,
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  ResponseDescriptorOf,
  TextResponseDescriptor,
} from '@t-rest/core'
import { ExpressResponse } from './express-type-shortcuts.js'

type AnyTypedRoute = { '~responses': unknown }

type JsonBodyMethods<TBody> = {
  json(body: TBody): void
  /** Alias of `json`, like express sends objects as json. */
  send(body: TBody): void
}

type TextBodyMethods = {
  send(body: string): void
}

type BinaryBodyMethods = {
  send(body: Uint8Array): void
  stream(body: NodeJS.ReadableStream): void
  file(path: string): void
}

type EmptyBodyMethods = {
  end(): void
}

// the body methods which match the kind of the descriptor
type BodyMethods<TDescriptor> = TDescriptor extends JsonResponseDescriptor<
  infer TBody
>
  ? JsonBodyMethods<TBody>
  : TDescriptor extends TextResponseDescriptor<string>
  ? TextBodyMethods
  : TDescriptor extends BinaryResponseDescriptor
  ? BinaryBodyMethods
  : TDescriptor extends EmptyResponseDescriptor
  ? EmptyBodyMethods
  : never

export type TypedStatusResponse<
  TRoute extends AnyTypedRoute,
  TStatus extends number
> = BodyMethods<ResponseDescriptorOf<TRoute, TStatus>>

/**
 * The response passed to route handlers, its body methods are typed by the
 * responses the route declares. `raw` is the native response of the framework.
 */
export interface TypedResponseBase<TRoute extends AnyTypedRoute> {
  status<TStatus extends DeclaredStatus<TRoute>>(
    code: TStatus
  ): TypedStatusResponse<TRoute, TStatus>
  /**
   * Sets a header. Body methods only set the `Content-Type` of the descriptor
   * when no `Content-Type` has been set before.
   */
  header(name: string, value: string | number | readonly string[]): this
  raw: ExpressResponse
}

// `json` and `send` without `status()` answer with 200, which has to be
// declared as json. They keep a status set before, e.g. on `raw`.
export type TypedResponse<TRoute extends AnyTypedRoute> =
  TypedResponseBase<TRoute> &
    (200 extends DeclaredStatus<TRoute>
      ? ResponseDescriptorOf<TRoute, 200> extends JsonResponseDescriptor<
          infer TBody
        >
        ? JsonBodyMethods<TBody>
        : {}
      : {})
