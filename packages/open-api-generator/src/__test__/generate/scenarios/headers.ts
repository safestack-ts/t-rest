import { BagOfRoutes, Route } from '@t-rest/core'
import { EnumType } from '../../../schema/type-schema.js'

type Greeting = {
  message: string
}

export default BagOfRoutes.withoutVersioning()
  .addRoute(Route.get('/greeting').response<Greeting>())
  .addRoute(
    Route.get('/greeting/localized')
      .metaData({
        headers: [
          {
            name: 'accept-language',
            description: 'Only german and french are supported here',
            required: true,
            type: EnumType({
              values: ['de', 'fr'],
              type: 'string',
              name: 'Localized Language',
            }),
          },
        ],
      })
      .response<Greeting>()
  )
  .build()
