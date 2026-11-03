import type {
  MediaType,
  Operation,
  Response,
  ResponseSlot,
  Shape,
} from './types.js'

type MapShape<A, B> = (shape: Shape<A>) => Shape<B>

const mapContent = <A, B>(
  content: Readonly<Record<string, MediaType<A>>>,
  map: MapShape<A, B>
): Record<string, MediaType<B>> =>
  Object.fromEntries(
    Object.entries(content).map(([type, media]) => [
      type,
      { ...media, shape: map(media.shape) },
    ])
  )

export const mapResponseShapes = <A, B>(
  response: Response<A>,
  map: MapShape<A, B>
): Response<B> => ({
  ...response,
  headers: response.headers.map((header) => ({
    ...header,
    shape: map(header.shape),
  })),
  content: mapContent(response.content, map),
})

/** Rebuilds every shape of `operation`; shared responses stay references. */
export const mapOperationShapes = <A, B>(
  operation: Operation<A>,
  map: MapShape<A, B>
): Operation<B> => ({
  ...operation,
  parameters: operation.parameters.map((parameter) => ({
    ...parameter,
    shape: map(parameter.shape),
  })),
  ...(operation.requestBody && {
    requestBody: {
      ...operation.requestBody,
      content: mapContent(operation.requestBody.content, map),
    },
  }),
  responses: Object.fromEntries(
    Object.entries(operation.responses).map(
      ([status, slot]): [string, ResponseSlot<B>] => [
        status,
        slot.kind === 'shared'
          ? slot
          : { kind: 'inline', response: mapResponseShapes(slot.response, map) },
      ]
    )
  ),
})

/** Every shape `operation` holds itself, without its shared responses. */
export const operationShapes = <R>(operation: Operation<R>): Shape<R>[] => {
  const shapes: Shape<R>[] = []
  mapOperationShapes(operation, (shape) => {
    shapes.push(shape)
    return shape
  })
  return shapes
}

export const responseShapes = <R>(response: Response<R>): Shape<R>[] => {
  const shapes: Shape<R>[] = []
  mapResponseShapes(response, (shape) => {
    shapes.push(shape)
    return shape
  })
  return shapes
}
