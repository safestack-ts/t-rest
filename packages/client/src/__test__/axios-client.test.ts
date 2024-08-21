import axios from 'axios'
import nock from 'nock'
import { RESTClient } from '../classes/rest-client'
import { demoBagOfRoutes } from '@typed-rest/core'
import { AxiosHTTPAdapter } from '../classes/axios-http-adapter'

axios.defaults.adapter = 'http'

const axiosInstance = axios.create({
  baseURL: 'http://localhost',
})
const apiClient = RESTClient.withVersioning(
  demoBagOfRoutes,
  '2024-03-01',
  new AxiosHTTPAdapter(axiosInstance)
)

test('GET request works', async () => {
  const scope = nock('http://localhost')
    .get('/basket')
    .reply(200, { id: 1, entries: [] })

  const response = await apiClient.get('/basket')

  expect(response.data).toEqual({ id: 1, entries: [] })

  scope.done()
})

test('POST request works', async () => {
  const scope = nock('http://localhost')
    .post('/basket', { entries: [{ id: 'a' }, { id: 'b' }] })
    .reply(201, { id: 42 })

  const response = await apiClient.post('/basket', {
    body: {
      entries: [{ id: 'a' }, { id: 'b' }],
    },
  })

  expect(response.data).toEqual({ id: 42 })

  scope.done()
})
