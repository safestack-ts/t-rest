import type {
  BinaryResponseDescriptor,
  EmptyResponseDescriptor,
  JsonResponseDescriptor,
  TextResponseDescriptor,
} from '../types/response-descriptor.js'

// `~body` is a phantom, it only exists on the type level
export const json = <TBody>(): JsonResponseDescriptor<TBody> => ({
  kind: 'json',
  contentType: 'application/json',
  '~body': null as any,
})

export const text = <TContentType extends string = 'text/plain'>(
  contentType: TContentType = 'text/plain' as TContentType
): TextResponseDescriptor<TContentType> => ({
  kind: 'text',
  contentType,
  '~body': null as any,
})

export const binary = <TContentType extends string>(
  contentType: TContentType
): BinaryResponseDescriptor<TContentType> => ({
  kind: 'binary',
  contentType,
  '~body': null as any,
})

export const empty = (): EmptyResponseDescriptor => ({
  kind: 'empty',
  contentType: undefined,
  '~body': null as any,
})
