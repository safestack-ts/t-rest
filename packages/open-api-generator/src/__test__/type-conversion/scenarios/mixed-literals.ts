import { BagOfRoutes, Route } from '@t-rest/core'

export default BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.get('/mixed-literals').response<{
      mixed: 'x' | 1
      strings: 'a' | 'b'
    }>()
  )
  .build()
