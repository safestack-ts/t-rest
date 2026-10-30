import { BagOfRoutes, Route } from '@t-rest/core'

enum Single {
  Only = 'only',
}

enum Computed {
  Small = 1,
  Large = 'large'.length,
}

enum OnlyComputed {
  Length = 'length'.length,
}

const enum Direction {
  Up = 'up',
  Down = 'down',
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/enums-and-literals').response<{
      single: Single
      computed: Computed
      onlyComputed: OnlyComputed
      direction: Direction
      maybeDirection: Direction | null
      literalTrue: true
      mixed: 'a' | 1 | true
      nothing: null | undefined
      nullableLiteral: 'a' | null
    }>()
  )
  .build()
