import { BagOfRoutes, Route } from '@t-rest/core'

enum Color {
  Red = 'red',
  Blue = 'blue',
}

enum Priority {
  Low,
  High,
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/native-enums').response<{
      color: Color
      maybeColor: Color | null
      priority: Priority
    }>()
  )
  .build()
