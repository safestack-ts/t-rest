import { BagOfRoutes, Route } from '@t-rest/core'
import axios from 'axios'
import { z } from 'zod'
import { AxiosHTTPAdapter } from '../classes/axios-http-adapter.js'
import { RESTClient } from '../classes/rest-client.js'

const bagOfRoutes = BagOfRoutes.withoutVersioning()
  .addRoute(
    Route.post('/uploads/:id')
      .multipart()
      .validate(
        z.object({
          params: z.object({ id: z.string() }),
          body: z.object({ name: z.string() }),
          files: z.array(z.object({ originalname: z.string() })),
        })
      )
      .response<{ id: number }>()
  )
  .addRoute(
    Route.post('/json')
      .validate(z.object({ body: z.object({ name: z.string() }) }))
      .response<{ id: number }>()
  )
  .build()

const client = RESTClient.withoutVersioning(
  bagOfRoutes,
  new AxiosHTTPAdapter(axios)
)

export const typedCalls = () => {
  const body = new FormData()

  client
    .post('/uploads/:id', { params: { id: '1' }, body })
    .then((response) => response.data.id satisfies number)

  // @ts-expect-error the other request input stays required
  client.post('/uploads/:id', { body })

  // @ts-expect-error the parsed body is no input of a multipart route
  client.post('/uploads/:id', { params: { id: '1' }, body: { name: 'a' } })

  // @ts-expect-error json routes take no form data
  client.post('/json', { body })
}
